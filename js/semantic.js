(function (root, factory) {
    const api = factory(root);
    root.DevCode = root.DevCode || {};
    root.DevCode.semantic = api;

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

    function analyze(program) {
        const symbols = Object.create(null);

        for (let i = 0; i < program.declarations.length; i += 1) {
            const declaration = program.declarations[i];
            for (let j = 0; j < declaration.names.length; j += 1) {
                const nameInfo = declaration.names[j];
                const key = nameInfo.name;
                if (symbols[key]) {
                    throw errors.createError('semantico', 'Variavel redeclarada: ' + key + '.', nameInfo.location);
                }
                symbols[key] = {
                    name: key,
                    type: declaration.varType.baseType,
                    isVector: declaration.varType.kind === 'vector',
                    size: declaration.varType.kind === 'vector' ? declaration.varType.size : null,
                    location: nameInfo.location
                };
            }
        }

        analyzeBlock(program.body, symbols);
        program.symbols = symbols;
        return { symbols: symbols };
    }

    function analyzeBlock(statements, symbols) {
        for (let i = 0; i < statements.length; i += 1) {
            analyzeStatement(statements[i], symbols);
        }
    }

    function analyzeStatement(statement, symbols) {
        switch (statement.type) {
            case 'AssignmentStatement':
                analyzeAssignment(statement, symbols);
                return;
            case 'ReadStatement':
                analyzeTarget(statement.target, symbols, true);
                return;
            case 'WriteStatement':
                for (let i = 0; i < statement.args.length; i += 1) {
                    inferExpression(statement.args[i], symbols);
                }
                return;
            case 'IfStatement': {
                const condition = inferExpression(statement.condition, symbols);
                requireType(condition, 'LOGICO', 'SE exige expressao logica.', statement.condition.location);
                analyzeBlock(statement.consequent, symbols);
                if (statement.alternate) {
                    analyzeBlock(statement.alternate, symbols);
                }
                return;
            }
            case 'WhileStatement': {
                const condition = inferExpression(statement.condition, symbols);
                requireType(condition, 'LOGICO', 'ENQUANTO exige expressao logica.', statement.condition.location);
                analyzeBlock(statement.body, symbols);
                return;
            }
            case 'ForStatement':
                analyzeFor(statement, symbols);
                return;
            case 'ChoiceStatement':
                analyzeChoice(statement, symbols);
                return;
            default:
                throw errors.createError('semantico', 'Comando nao suportado na analise semantica.', statement.location);
        }
    }

    function analyzeAssignment(statement, symbols) {
        const targetInfo = analyzeTarget(statement.target, symbols, false);
        const expressionInfo = inferExpression(statement.expression, symbols);

        if (!isAssignable(targetInfo.type, expressionInfo.type)) {
            throw errors.createError(
                'semantico',
                'Atribuicao incompativel: nao e possivel atribuir ' + expressionInfo.type + ' em ' + targetInfo.type + '.',
                statement.location
            );
        }
    }

    function analyzeFor(statement, symbols) {
        const control = lookupSymbol(statement.control.name, symbols, statement.control.location);
        if (control.isVector) {
            throw errors.createError('semantico', 'Variavel de controle do PARA nao pode ser vetor.', statement.control.location);
        }
        if (control.type !== 'INTEIRO') {
            throw errors.createError('semantico', 'Variavel de controle do PARA deve ser INTEIRO.', statement.control.location);
        }

        const startInfo = inferExpression(statement.startExpr, symbols);
        const endInfo = inferExpression(statement.endExpr, symbols);
        const stepInfo = inferExpression(statement.stepExpr, symbols);

        if (!isAssignable('INTEIRO', startInfo.type) || !isAssignable('INTEIRO', endInfo.type) || !isAssignable('INTEIRO', stepInfo.type)) {
            throw errors.createError('semantico', 'PARA exige expressoes inteiras em DE, ATE e PASSO.', statement.location);
        }

        if (stepInfo.constant && Number(stepInfo.value) === 0) {
            throw errors.createError('semantico', 'PASSO 0 nao e permitido.', statement.stepExpr.location);
        }

        analyzeBlock(statement.body, symbols);
    }

    function analyzeChoice(statement, symbols) {
        const switchInfo = inferExpression(statement.expression, symbols);
        for (let i = 0; i < statement.cases.length; i += 1) {
            const caseInfo = inferExpression(statement.cases[i].value, symbols);
            if (!canCompare(switchInfo.type, caseInfo.type)) {
                throw errors.createError(
                    'semantico',
                    'CASO possui tipo incompativel com a expressao de ESCOLHA.',
                    statement.cases[i].location
                );
            }
            analyzeBlock(statement.cases[i].body, symbols);
        }
        if (statement.otherwise) {
            analyzeBlock(statement.otherwise.body, symbols);
        }
    }

    function analyzeTarget(target, symbols, forRead) {
        if (target.type === 'Identifier') {
            const symbol = lookupSymbol(target.name, symbols, target.location);
            if (symbol.isVector) {
                throw errors.createError(
                    'semantico',
                    'Vetor ' + target.name + ' precisa de indice para ser usado.',
                    target.location
                );
            }
            return {
                type: symbol.type,
                symbol: symbol,
                readable: !!forRead
            };
        }

        if (target.type === 'IndexAccess') {
            const symbol = lookupSymbol(target.target.name, symbols, target.location);
            if (!symbol.isVector) {
                throw errors.createError(
                    'semantico',
                    'Variavel ' + target.target.name + ' nao e vetor.',
                    target.location
                );
            }
            const indexInfo = inferExpression(target.index, symbols);
            requireType(indexInfo, 'INTEIRO', 'Indice de vetor deve ser INTEIRO.', target.index.location);
            if (indexInfo.constant && (indexInfo.value < 0 || indexInfo.value >= symbol.size)) {
                throw errors.createError('semantico', 'Indice de vetor fora do limite declarado.', target.index.location);
            }
            return {
                type: symbol.type,
                symbol: symbol,
                readable: !!forRead
            };
        }

        throw errors.createError('semantico', 'Alvo invalido.', target.location);
    }

    function inferExpression(expression, symbols) {
        switch (expression.type) {
            case 'Literal':
                return {
                    type: expression.valueType,
                    constant: true,
                    value: expression.value
                };
            case 'Identifier': {
                const symbol = lookupSymbol(expression.name, symbols, expression.location);
                if (symbol.isVector) {
                    throw errors.createError(
                        'semantico',
                        'Vetor ' + expression.name + ' nao pode ser usado sem indice.',
                        expression.location
                    );
                }
                return { type: symbol.type, constant: false, value: null };
            }
            case 'IndexAccess': {
                const symbol = lookupSymbol(expression.target.name, symbols, expression.location);
                if (!symbol.isVector) {
                    throw errors.createError('semantico', 'Variavel ' + symbol.name + ' nao e vetor.', expression.location);
                }
                const indexInfo = inferExpression(expression.index, symbols);
                requireType(indexInfo, 'INTEIRO', 'Indice de vetor deve ser INTEIRO.', expression.index.location);
                if (indexInfo.constant && (indexInfo.value < 0 || indexInfo.value >= symbol.size)) {
                    throw errors.createError('semantico', 'Indice de vetor fora do limite declarado.', expression.index.location);
                }
                return { type: symbol.type, constant: false, value: null };
            }
            case 'UnaryExpression':
                return inferUnary(expression, symbols);
            case 'BinaryExpression':
                return inferBinary(expression, symbols);
            default:
                throw errors.createError('semantico', 'Expressao nao suportada.', expression.location);
        }
    }

    function inferUnary(expression, symbols) {
        const argument = inferExpression(expression.argument, symbols);

        if (expression.operator === 'NAO') {
            requireType(argument, 'LOGICO', 'NAO exige operando logico.', expression.location);
            return {
                type: 'LOGICO',
                constant: argument.constant,
                value: argument.constant ? !argument.value : null
            };
        }

        if (language.NUMERIC_TYPES.indexOf(argument.type) === -1) {
            throw errors.createError('semantico', 'Operador unario exige operando numerico.', expression.location);
        }

        return {
            type: argument.type,
            constant: argument.constant,
            value: argument.constant
                ? (expression.operator === '-' ? -argument.value : +argument.value)
                : null
        };
    }

    function inferBinary(expression, symbols) {
        const left = inferExpression(expression.left, symbols);
        const right = inferExpression(expression.right, symbols);
        const operator = expression.operator;

        if (operator === 'E' || operator === 'OU') {
            requireType(left, 'LOGICO', 'Operador logico exige valores LOGICO.', expression.left.location);
            requireType(right, 'LOGICO', 'Operador logico exige valores LOGICO.', expression.right.location);
            return {
                type: 'LOGICO',
                constant: left.constant && right.constant,
                value: left.constant && right.constant
                    ? (operator === 'E' ? left.value && right.value : left.value || right.value)
                    : null
            };
        }

        if (operator === '+' || operator === '-' || operator === '*' || operator === '/') {
            requireNumeric(left, expression.left.location);
            requireNumeric(right, expression.right.location);
            return {
                type: operator === '/' || left.type === 'REAL' || right.type === 'REAL' ? 'REAL' : 'INTEIRO',
                constant: left.constant && right.constant,
                value: left.constant && right.constant ? computeNumeric(operator, left.value, right.value) : null
            };
        }

        if (operator === '=' || operator === '!=') {
            if (!canCompare(left.type, right.type)) {
                throw errors.createError('semantico', 'Comparacao entre tipos incompativeis.', expression.location);
            }
            return {
                type: 'LOGICO',
                constant: left.constant && right.constant,
                value: left.constant && right.constant
                    ? (operator === '=' ? left.value === right.value : left.value !== right.value)
                    : null
            };
        }

        if (operator === '<' || operator === '<=' || operator === '>' || operator === '>=') {
            requireNumeric(left, expression.left.location);
            requireNumeric(right, expression.right.location);
            return {
                type: 'LOGICO',
                constant: left.constant && right.constant,
                value: left.constant && right.constant ? computeComparison(operator, left.value, right.value) : null
            };
        }

        throw errors.createError('semantico', 'Operador nao suportado.', expression.location);
    }

    function lookupSymbol(name, symbols, location) {
        const symbol = symbols[name];
        if (!symbol) {
            throw errors.createError('semantico', 'Variavel nao declarada: ' + name + '.', location);
        }
        return symbol;
    }

    function requireType(info, expectedType, message, location) {
        if (info.type !== expectedType) {
            throw errors.createError('semantico', message, location);
        }
    }

    function requireNumeric(info, location) {
        if (language.NUMERIC_TYPES.indexOf(info.type) === -1) {
            throw errors.createError('semantico', 'Expressao numerica esperada.', location);
        }
    }

    function isAssignable(targetType, sourceType) {
        return targetType === sourceType || (targetType === 'REAL' && sourceType === 'INTEIRO');
    }

    function canCompare(leftType, rightType) {
        if (leftType === rightType) {
            return true;
        }
        return language.NUMERIC_TYPES.indexOf(leftType) !== -1 && language.NUMERIC_TYPES.indexOf(rightType) !== -1;
    }

    function computeNumeric(operator, left, right) {
        switch (operator) {
            case '+':
                return left + right;
            case '-':
                return left - right;
            case '*':
                return left * right;
            case '/':
                return left / right;
            default:
                return null;
        }
    }

    function computeComparison(operator, left, right) {
        switch (operator) {
            case '<':
                return left < right;
            case '<=':
                return left <= right;
            case '>':
                return left > right;
            case '>=':
                return left >= right;
            default:
                return false;
        }
    }

    return {
        analyze,
        inferExpression
    };
}));
