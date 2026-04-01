(function (root, factory) {
    const api = factory(root);
    root.DevCode = root.DevCode || {};
    root.DevCode.compiler = api;

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    const lexer = root.DevCode && root.DevCode.lexer
        ? root.DevCode.lexer
        : require('./lexer.js');
    const parser = root.DevCode && root.DevCode.parser
        ? root.DevCode.parser
        : require('./parser.js');
    const semantic = root.DevCode && root.DevCode.semantic
        ? root.DevCode.semantic
        : require('./semantic.js');
    const runtime = root.DevCode && root.DevCode.runtime
        ? root.DevCode.runtime
        : require('./runtime.js');
    const language = root.DevCode && root.DevCode.language
        ? root.DevCode.language
        : require('./language.js');

    function normalizeSource(source) {
        return String(source == null ? '' : source).replace(/\r\n?/g, '\n');
    }

    function compileSource(source) {
        const normalizedSource = normalizeSource(source);
        const lexed = lexer.tokenize(normalizedSource);
        const ast = parser.parse(lexed.tokens, lexed.source);
        const semantics = semantic.analyze(ast);
        return {
            source: normalizedSource,
            tokens: lexed.tokens,
            ast: ast,
            semantics: semantics
        };
    }

    async function runSource(source, options) {
        const compilation = compileSource(source);
        const execution = await runtime.execute(compilation.ast, options || {});
        return {
            compilation: compilation,
            execution: execution
        };
    }

    function validateSource(source) {
        return compileSource(source);
    }

    function formatSource(source) {
        const compilation = compileSource(source);
        return formatProgram(compilation.ast);
    }

    function formatProgram(program) {
        const lines = [];

        if (program.algorithmName) {
            lines.push('ALGORITMO ' + formatAlgorithmName(program.algorithmName));
        }

        lines.push('DECLARE');
        for (let i = 0; i < program.declarations.length; i += 1) {
            lines.push(formatDeclaration(program.declarations[i]));
        }
        lines.push('INICIO');
        appendBlock(program.body, lines, 1);
        lines.push('FIM');

        return lines.join('\n');
    }

    function appendBlock(statements, lines, depth) {
        for (let i = 0; i < statements.length; i += 1) {
            const statementLines = formatStatement(statements[i], depth);
            for (let j = 0; j < statementLines.length; j += 1) {
                lines.push(statementLines[j]);
            }
        }
    }

    function formatDeclaration(declaration) {
        const names = declaration.names.map(function (item) {
            return item.name;
        }).join(', ');
        return names + ': ' + formatTypeSpec(declaration.varType);
    }

    function formatTypeSpec(varType) {
        if (varType.kind === 'vector') {
            return 'VETOR[' + varType.size + '] DE ' + varType.baseType;
        }
        return varType.baseType;
    }

    function formatStatement(statement, depth) {
        const indent = indentOf(depth);

        switch (statement.type) {
            case 'AssignmentStatement':
                return [indent + formatTarget(statement.target) + ' <- ' + formatExpression(statement.expression)];
            case 'ReadStatement':
                return [indent + 'LEIA ' + formatTarget(statement.target)];
            case 'WriteStatement':
                return [
                    indent
                    + (statement.newline ? 'ESCREVAL' : 'ESCREVA')
                    + (statement.args.length ? ' ' + statement.args.map(formatExpression).join(', ') : '')
                ];
            case 'IfStatement': {
                const lines = [indent + 'SE ' + formatExpression(statement.condition) + ' ENTAO'];
                appendBlock(statement.consequent, lines, depth + 1);
                if (statement.alternate) {
                    lines.push(indent + 'SENAO');
                    appendBlock(statement.alternate, lines, depth + 1);
                }
                lines.push(indent + 'FIMSE');
                return lines;
            }
            case 'WhileStatement': {
                const lines = [indent + 'ENQUANTO ' + formatExpression(statement.condition) + ' FACA'];
                appendBlock(statement.body, lines, depth + 1);
                lines.push(indent + 'FIMENQUANTO');
                return lines;
            }
            case 'ForStatement': {
                const lines = [
                    indent
                    + 'PARA '
                    + statement.control.name
                    + ' DE '
                    + formatExpression(statement.startExpr)
                    + ' ATE '
                    + formatExpression(statement.endExpr)
                    + ' PASSO '
                    + formatExpression(statement.stepExpr)
                    + ' FACA'
                ];
                appendBlock(statement.body, lines, depth + 1);
                lines.push(indent + 'FIMPARA');
                return lines;
            }
            case 'ChoiceStatement': {
                const lines = [indent + 'ESCOLHA ' + formatExpression(statement.expression)];
                for (let i = 0; i < statement.cases.length; i += 1) {
                    lines.push(indent + 'CASO ' + formatExpression(statement.cases[i].value) + ':');
                    appendBlock(statement.cases[i].body, lines, depth + 1);
                }
                if (statement.otherwise) {
                    lines.push(indent + 'OUTROCASO:');
                    appendBlock(statement.otherwise.body, lines, depth + 1);
                }
                lines.push(indent + 'FIMESCOLHA');
                return lines;
            }
            default:
                return [indent + '// comando nao formatado'];
        }
    }

    function formatTarget(target) {
        if (target.type === 'Identifier') {
            return target.name;
        }
        return target.target.name + '[' + formatExpression(target.index) + ']';
    }

    function formatAlgorithmName(nameInfo) {
        if (nameInfo.kind === 'STRING') {
            return '"' + escapeString(nameInfo.value) + '"';
        }
        return nameInfo.value;
    }

    function formatExpression(expression, parentPrecedence) {
        const currentPrecedence = precedenceOfExpression(expression);
        const parent = typeof parentPrecedence === 'number' ? parentPrecedence : 0;
        let rendered;

        switch (expression.type) {
            case 'Literal':
                rendered = formatLiteral(expression);
                break;
            case 'Identifier':
                rendered = expression.name;
                break;
            case 'IndexAccess':
                rendered = expression.target.name + '[' + formatExpression(expression.index) + ']';
                break;
            case 'UnaryExpression':
                rendered = expression.operator + (expression.operator === 'NAO' ? ' ' : '') + formatExpression(expression.argument, 99);
                break;
            case 'BinaryExpression': {
                const precedence = language.OPERATOR_PRECEDENCE[expression.operator] || 0;
                const left = formatExpression(expression.left, precedence);
                const right = formatExpression(expression.right, precedence + 1);
                rendered = left + ' ' + expression.operator + ' ' + right;
                break;
            }
            default:
                rendered = '';
                break;
        }

        if (currentPrecedence && currentPrecedence < parent) {
            return '(' + rendered + ')';
        }

        return rendered;
    }

    function precedenceOfExpression(expression) {
        if (expression.type === 'BinaryExpression') {
            return language.OPERATOR_PRECEDENCE[expression.operator] || 0;
        }
        if (expression.type === 'UnaryExpression') {
            return 99;
        }
        return 0;
    }

    function formatLiteral(expression) {
        if (expression.valueType === 'CARACTERE') {
            return '"' + escapeString(expression.value) + '"';
        }
        if (expression.valueType === 'LOGICO') {
            return expression.value ? 'VERDADEIRO' : 'FALSO';
        }
        return String(expression.value);
    }

    function indentOf(depth) {
        return new Array(depth + 1).join('    ');
    }

    function escapeString(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    return {
        compileSource,
        runSource,
        validateSource,
        formatSource,
        formatProgram
    };
}));
