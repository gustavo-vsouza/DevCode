(function (root, factory) {
    const api = factory(root);
    root.DevCode = root.DevCode || {};
    root.DevCode.parser = api;

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    const errors = root.DevCode && root.DevCode.errors
        ? root.DevCode.errors
        : require('./errors.js');
    const language = root.DevCode && root.DevCode.language
        ? root.DevCode.language
        : require('./language.js');

    function Parser(tokens, source) {
        this.tokens = tokens || [];
        this.source = source || '';
        this.index = 0;
    }

    Parser.prototype.current = function () {
        return this.tokens[this.index] || this.tokens[this.tokens.length - 1];
    };

    Parser.prototype.peek = function (offset) {
        return this.tokens[this.index + (offset || 0)] || this.tokens[this.tokens.length - 1];
    };

    Parser.prototype.advance = function () {
        const token = this.current();
        this.index += 1;
        return token;
    };

    Parser.prototype.match = function (type, value) {
        const token = this.current();
        if (!token || token.type !== type) {
            return null;
        }
        if (value != null && token.value !== value) {
            return null;
        }
        this.index += 1;
        return token;
    };

    Parser.prototype.matchKeyword = function (value) {
        return this.match('KEYWORD', value);
    };

    Parser.prototype.matchSymbol = function (value) {
        return this.match('SYMBOL', value);
    };

    Parser.prototype.check = function (type, value) {
        const token = this.current();
        if (!token || token.type !== type) {
            return false;
        }
        return value == null ? true : token.value === value;
    };

    Parser.prototype.checkKeyword = function (value) {
        return this.check('KEYWORD', value);
    };

    Parser.prototype.skipNewlines = function () {
        while (this.check('NEWLINE')) {
            this.advance();
        }
    };

    Parser.prototype.expect = function (type, value, message) {
        const token = this.current();
        if (token && token.type === type && (value == null || token.value === value)) {
            return this.advance();
        }

        throw errors.createError(
            'sintatico',
            message,
            token || this.tokens[this.tokens.length - 1]
        );
    };

    Parser.prototype.expectKeyword = function (value, message) {
        return this.expect('KEYWORD', value, message);
    };

    Parser.prototype.expectSymbol = function (value, message) {
        return this.expect('SYMBOL', value, message);
    };

    Parser.prototype.expectLineBreak = function (message) {
        if (this.check('NEWLINE')) {
            this.skipNewlines();
            return;
        }
        if (this.check('EOF')) {
            return;
        }
        throw errors.createError('sintatico', message, this.current());
    };

    Parser.prototype.nodeLocation = function (token) {
        return {
            line: token.line,
            column: token.column,
            length: token.length,
            source: token.source
        };
    };

    Parser.prototype.parseProgram = function () {
        const program = {
            type: 'Program',
            algorithmName: null,
            declarations: [],
            body: [],
            location: this.nodeLocation(this.current())
        };

        this.skipNewlines();

        if (this.checkKeyword('ALGORITMO')) {
            const start = this.advance();
            if (!this.check('NEWLINE') && !this.check('EOF')) {
                const nameToken = this.advance();
                if (nameToken.type !== 'STRING' && nameToken.type !== 'IDENTIFIER') {
                    throw errors.createError('sintatico', 'ALGORITMO deve ser seguido por nome ou string.', nameToken);
                }
                program.algorithmName = {
                    kind: nameToken.type,
                    value: nameToken.value
                };
            }
            this.expectLineBreak('ALGORITMO deve terminar na mesma linha.');
            program.location = this.nodeLocation(start);
        }

        this.skipNewlines();
        this.expectKeyword('DECLARE', 'Programa deve iniciar a secao DECLARE.');
        this.expectLineBreak('DECLARE deve terminar a linha.');

        while (!this.checkKeyword('INICIO')) {
            if (this.check('EOF')) {
                throw errors.createError('sintatico', 'Secao INICIO nao foi encontrada.', this.current());
            }
            if (this.check('NEWLINE')) {
                this.skipNewlines();
                continue;
            }
            program.declarations.push(this.parseDeclaration());
        }

        this.expectKeyword('INICIO', 'Secao INICIO obrigatoria.');
        this.expectLineBreak('INICIO deve terminar a linha.');
        program.body = this.parseBlock(['FIM']);
        this.expectKeyword('FIM', 'Programa deve terminar com FIM.');

        if (!this.check('EOF') && !this.check('NEWLINE')) {
            throw errors.createError('sintatico', 'Nenhum codigo pode existir apos FIM.', this.current());
        }

        this.skipNewlines();
        this.expect('EOF', null, 'Codigo adicional encontrado apos FIM.');

        return program;
    };

    Parser.prototype.parseDeclaration = function () {
        const start = this.expect('IDENTIFIER', null, 'Declaracao deve iniciar com um identificador.');
        const names = [{ name: start.value, location: this.nodeLocation(start) }];

        while (this.matchSymbol(',')) {
            const next = this.expect('IDENTIFIER', null, 'Esperado identificador apos virgula.');
            names.push({ name: next.value, location: this.nodeLocation(next) });
        }

        this.expectSymbol(':', 'Declaracao deve conter ":".');
        const varType = this.parseTypeSpec();
        this.expectLineBreak('Declaracao deve terminar na mesma linha.');

        return {
            type: 'VarDeclaration',
            names,
            varType,
            location: this.nodeLocation(start)
        };
    };

    Parser.prototype.parseTypeSpec = function () {
        const token = this.current();

        if (this.matchKeyword('VETOR')) {
            this.expectSymbol('[', 'VETOR deve informar um tamanho entre colchetes.');
            const sizeToken = this.expect('NUMBER', null, 'Tamanho do vetor deve ser um numero inteiro.');
            if (!Number.isInteger(sizeToken.value) || sizeToken.value <= 0) {
                throw errors.createError('sintatico', 'Tamanho do vetor deve ser inteiro positivo.', sizeToken);
            }
            this.expectSymbol(']', 'Esperado fechamento de colchetes no vetor.');
            this.expectKeyword('DE', 'Declaracao de vetor deve usar "DE".');
            const baseType = this.expect('KEYWORD', null, 'Tipo base do vetor obrigatorio.');
            if (language.BASE_TYPES.indexOf(baseType.value) === -1) {
                throw errors.createError('sintatico', 'Tipo invalido para vetor.', baseType);
            }

            return {
                kind: 'vector',
                baseType: baseType.value,
                size: sizeToken.value,
                location: this.nodeLocation(token)
            };
        }

        const baseType = this.expect('KEYWORD', null, 'Tipo da variavel obrigatorio.');
        if (language.BASE_TYPES.indexOf(baseType.value) === -1) {
            throw errors.createError('sintatico', 'Tipo invalido na declaracao.', baseType);
        }

        return {
            kind: 'scalar',
            baseType: baseType.value,
            location: this.nodeLocation(baseType)
        };
    };

    Parser.prototype.parseBlock = function (stopKeywords) {
        const statements = [];
        while (!this.check('EOF')) {
            if (this.check('NEWLINE')) {
                this.skipNewlines();
                continue;
            }
            if (this.check('KEYWORD') && stopKeywords.indexOf(this.current().value) !== -1) {
                break;
            }
            statements.push(this.parseStatement());
        }
        return statements;
    };

    Parser.prototype.parseStatement = function () {
        const token = this.current();

        if (token.type === 'IDENTIFIER') {
            return this.parseAssignment();
        }

        if (token.type !== 'KEYWORD') {
            throw errors.createError('sintatico', 'Comando invalido ou desconhecido.', token);
        }

        switch (token.value) {
            case 'ESCREVA':
            case 'ESCREVAL':
                return this.parseWrite();
            case 'LEIA':
                return this.parseRead();
            case 'SE':
                return this.parseIf();
            case 'ENQUANTO':
                return this.parseWhile();
            case 'PARA':
                return this.parseFor();
            case 'ESCOLHA':
                return this.parseChoice();
            case 'SENAO':
                throw errors.createError('sintatico', 'SENAO encontrado sem um SE correspondente.', token);
            case 'CASO':
                throw errors.createError('sintatico', 'CASO so pode ser usado dentro de ESCOLHA.', token);
            case 'OUTROCASO':
                throw errors.createError('sintatico', 'OUTROCASO so pode ser usado dentro de ESCOLHA.', token);
            case 'FIMSE':
            case 'FIMENQUANTO':
            case 'FIMPARA':
            case 'FIMESCOLHA':
            case 'FIM':
                throw errors.createError('sintatico', 'Bloco fechado sem abertura correspondente.', token);
            default:
                throw errors.createError('sintatico', 'Comando invalido ou desconhecido.', token);
        }
    };

    Parser.prototype.parseWrite = function () {
        const start = this.advance();
        const args = [];
        let usedParentheses = false;

        if (this.matchSymbol('(')) {
            usedParentheses = true;
            if (!this.check('SYMBOL', ')')) {
                args.push(this.parseExpression());
                while (this.matchSymbol(',')) {
                    args.push(this.parseExpression());
                }
            }
            this.expectSymbol(')', 'ESCREVA deve fechar parenteses.');
        } else if (!this.check('NEWLINE') && !this.check('EOF')) {
            args.push(this.parseExpression());
            while (this.matchSymbol(',')) {
                args.push(this.parseExpression());
            }
        }

        if (!usedParentheses && this.check('SYMBOL', ')')) {
            throw errors.createError('sintatico', 'Parenteses inesperado em ESCREVA.', this.current());
        }

        this.expectLineBreak('ESCREVA deve terminar na mesma linha.');

        return {
            type: 'WriteStatement',
            newline: start.value === 'ESCREVAL',
            args,
            location: this.nodeLocation(start)
        };
    };

    Parser.prototype.parseRead = function () {
        const start = this.advance();
        const target = this.parseTarget();
        this.expectLineBreak('LEIA deve terminar na mesma linha.');
        return {
            type: 'ReadStatement',
            target,
            location: this.nodeLocation(start)
        };
    };

    Parser.prototype.parseAssignment = function () {
        const start = this.current();
        const target = this.parseTarget();
        this.expectSymbol('<-', 'Atribuicao deve usar "<-".');
        const expression = this.parseExpression();
        this.expectLineBreak('Atribuicao deve terminar na mesma linha.');

        return {
            type: 'AssignmentStatement',
            target,
            expression,
            location: this.nodeLocation(start)
        };
    };

    Parser.prototype.parseIf = function () {
        const start = this.advance();
        const condition = this.parseExpression();
        this.expectKeyword('ENTAO', 'SE deve usar ENTAO.');
        this.expectLineBreak('Cabecalho do SE deve terminar na mesma linha.');

        const consequent = this.parseBlock(['SENAO', 'FIMSE']);
        let alternate = null;

        if (this.matchKeyword('SENAO')) {
            this.expectLineBreak('SENAO deve terminar a linha.');
            alternate = this.parseBlock(['SENAO', 'FIMSE']);
            if (this.checkKeyword('SENAO')) {
                throw errors.createError('sintatico', 'Apenas um SENAO e permitido por bloco SE.', this.current());
            }
        }

        this.expectKeyword('FIMSE', 'Bloco SE deve terminar com FIMSE.');
        this.expectLineBreak('FIMSE deve terminar a linha.');

        return {
            type: 'IfStatement',
            condition,
            consequent,
            alternate,
            location: this.nodeLocation(start)
        };
    };

    Parser.prototype.parseWhile = function () {
        const start = this.advance();
        const condition = this.parseExpression();
        this.expectKeyword('FACA', 'ENQUANTO deve usar FACA.');
        this.expectLineBreak('Cabecalho do ENQUANTO deve terminar na mesma linha.');
        const body = this.parseBlock(['FIMENQUANTO']);
        this.expectKeyword('FIMENQUANTO', 'ENQUANTO deve terminar com FIMENQUANTO.');
        this.expectLineBreak('FIMENQUANTO deve terminar a linha.');

        return {
            type: 'WhileStatement',
            condition,
            body,
            location: this.nodeLocation(start)
        };
    };

    Parser.prototype.parseFor = function () {
        const start = this.advance();
        const control = this.expect('IDENTIFIER', null, 'PARA deve informar uma variavel de controle.');
        this.expectKeyword('DE', 'PARA deve usar DE.');
        const startExpr = this.parseExpression();
        this.expectKeyword('ATE', 'PARA deve usar ATE.');
        const endExpr = this.parseExpression();
        let stepExpr = null;
        if (this.matchKeyword('PASSO')) {
            stepExpr = this.parseExpression();
        }
        this.expectKeyword('FACA', 'PARA deve usar FACA.');
        this.expectLineBreak('Cabecalho do PARA deve terminar na mesma linha.');
        const body = this.parseBlock(['FIMPARA']);
        this.expectKeyword('FIMPARA', 'PARA deve terminar com FIMPARA.');
        this.expectLineBreak('FIMPARA deve terminar a linha.');

        return {
            type: 'ForStatement',
            control: {
                type: 'Identifier',
                name: control.value,
                location: this.nodeLocation(control)
            },
            startExpr,
            endExpr,
            stepExpr: stepExpr || {
                type: 'Literal',
                valueType: 'INTEIRO',
                value: 1,
                location: this.nodeLocation(control)
            },
            body,
            location: this.nodeLocation(start)
        };
    };

    Parser.prototype.parseChoice = function () {
        const start = this.advance();
        const expression = this.parseExpression();
        this.expectLineBreak('ESCOLHA deve terminar a linha de cabecalho.');

        const cases = [];
        let otherwise = null;

        while (!this.check('EOF') && !this.checkKeyword('FIMESCOLHA')) {
            if (this.check('NEWLINE')) {
                this.skipNewlines();
                continue;
            }

            if (this.matchKeyword('CASO')) {
                const caseToken = this.tokens[this.index - 1];
                const caseValue = this.parseExpression();
                this.matchSymbol(':');
                this.expectLineBreak('CASO deve terminar a linha.');
                const body = this.parseBlock(['CASO', 'OUTROCASO', 'FIMESCOLHA']);
                cases.push({
                    type: 'ChoiceCase',
                    value: caseValue,
                    body,
                    location: this.nodeLocation(caseToken)
                });
                continue;
            }

            if (this.matchKeyword('OUTROCASO')) {
                const otherToken = this.tokens[this.index - 1];
                if (otherwise) {
                    throw errors.createError('sintatico', 'Apenas um OUTROCASO e permitido por bloco ESCOLHA.', otherToken);
                }
                this.matchSymbol(':');
                this.expectLineBreak('OUTROCASO deve terminar a linha.');
                otherwise = {
                    type: 'ChoiceOtherwise',
                    body: this.parseBlock(['FIMESCOLHA']),
                    location: this.nodeLocation(otherToken)
                };
                continue;
            }

            throw errors.createError('sintatico', 'ESCOLHA aceita apenas CASO, OUTROCASO ou FIMESCOLHA.', this.current());
        }

        if (cases.length === 0 && !otherwise) {
            throw errors.createError('sintatico', 'ESCOLHA precisa de ao menos um CASO ou OUTROCASO.', start);
        }

        this.expectKeyword('FIMESCOLHA', 'ESCOLHA deve terminar com FIMESCOLHA.');
        this.expectLineBreak('FIMESCOLHA deve terminar a linha.');

        return {
            type: 'ChoiceStatement',
            expression,
            cases,
            otherwise,
            location: this.nodeLocation(start)
        };
    };

    Parser.prototype.parseTarget = function () {
        const identifier = this.expect('IDENTIFIER', null, 'Identificador esperado.');
        const base = {
            type: 'Identifier',
            name: identifier.value,
            location: this.nodeLocation(identifier)
        };

        if (this.matchSymbol('[')) {
            const indexExpression = this.parseExpression();
            this.expectSymbol(']', 'Indice de vetor precisa fechar colchetes.');
            return {
                type: 'IndexAccess',
                target: base,
                index: indexExpression,
                location: this.nodeLocation(identifier)
            };
        }

        return base;
    };

    Parser.prototype.parseExpression = function (minimumPrecedence) {
        const min = typeof minimumPrecedence === 'number' ? minimumPrecedence : 0;
        let left = this.parseUnary();

        while (true) {
            const token = this.current();
            const operator = this.operatorFromToken(token);
            if (!operator) {
                break;
            }
            const precedence = language.OPERATOR_PRECEDENCE[operator];
            if (precedence == null || precedence < min) {
                break;
            }
            this.advance();
            const right = this.parseExpression(precedence + 1);
            left = {
                type: 'BinaryExpression',
                operator,
                left,
                right,
                location: this.nodeLocation(token)
            };
        }

        return left;
    };

    Parser.prototype.parseUnary = function () {
        const token = this.current();
        const operator = this.unaryOperatorFromToken(token);
        if (operator) {
            this.advance();
            return {
                type: 'UnaryExpression',
                operator,
                argument: this.parseUnary(),
                location: this.nodeLocation(token)
            };
        }
        return this.parsePrimary();
    };

    Parser.prototype.parsePrimary = function () {
        const token = this.current();

        if (!token) {
            throw errors.createError('sintatico', 'Expressao incompleta.', this.tokens[this.tokens.length - 1]);
        }

        if (token.type === 'NUMBER') {
            this.advance();
            return {
                type: 'Literal',
                valueType: Number.isInteger(token.value) ? 'INTEIRO' : 'REAL',
                value: token.value,
                location: this.nodeLocation(token)
            };
        }

        if (token.type === 'STRING') {
            this.advance();
            return {
                type: 'Literal',
                valueType: 'CARACTERE',
                value: token.value,
                location: this.nodeLocation(token)
            };
        }

        if (token.type === 'KEYWORD' && (token.value === 'VERDADEIRO' || token.value === 'FALSO')) {
            this.advance();
            return {
                type: 'Literal',
                valueType: 'LOGICO',
                value: token.value === 'VERDADEIRO',
                location: this.nodeLocation(token)
            };
        }

        if (token.type === 'IDENTIFIER') {
            return this.parseTarget();
        }

        if (this.matchSymbol('(')) {
            const expr = this.parseExpression();
            this.expectSymbol(')', 'Parenteses nao foi fechado.');
            return expr;
        }

        throw errors.createError('sintatico', 'Expressao invalida ou incompleta.', token);
    };

    Parser.prototype.operatorFromToken = function (token) {
        if (!token) {
            return null;
        }

        if (token.type === 'KEYWORD' && (token.value === 'E' || token.value === 'OU')) {
            return token.value;
        }

        if (token.type === 'SYMBOL' && Object.prototype.hasOwnProperty.call(language.OPERATOR_PRECEDENCE, token.value)) {
            return token.value;
        }

        return null;
    };

    Parser.prototype.unaryOperatorFromToken = function (token) {
        if (!token) {
            return null;
        }

        if (token.type === 'KEYWORD' && token.value === 'NAO') {
            return 'NAO';
        }

        if (token.type === 'SYMBOL' && (token.value === '+' || token.value === '-')) {
            return token.value;
        }

        return null;
    };

    function parse(tokens, source) {
        const parser = new Parser(tokens, source);
        return parser.parseProgram();
    }

    return {
        parse,
        Parser
    };
}));
