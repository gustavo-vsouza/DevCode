(function (root, factory) {
    const api = factory(root);
    root.DevCode = root.DevCode || {};
    root.DevCode.runtime = api;

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    const errors = root.DevCode && root.DevCode.errors
        ? root.DevCode.errors
        : require('./errors.js');

    async function execute(program, options) {
        const settings = options || {};
        const symbols = program.symbols || Object.create(null);
        const state = {
            symbols: symbols,
            variables: initializeVariables(symbols),
            output: '',
            steps: 0,
            maxSteps: typeof settings.maxSteps === 'number' ? settings.maxSteps : 20000,
            stopSignal: settings.stopSignal || { requested: false }
        };

        await executeBlock(program.body, state, settings);

        return {
            output: state.output,
            variables: snapshotVariables(state.variables),
            steps: state.steps
        };
    }

    async function executeBlock(statements, state, settings) {
        for (let i = 0; i < statements.length; i += 1) {
            await tick(statements[i], state, settings);
            await executeStatement(statements[i], state, settings);
            if (typeof settings.onStatementEnd === 'function') {
                await settings.onStatementEnd({
                    statement: statements[i],
                    snapshot: snapshotVariables(state.variables)
                });
            }
        }
    }

    async function tick(statement, state, settings) {
        ensureCanContinue(state, statement.location);
        state.steps += 1;
        if (state.steps > state.maxSteps) {
            throw errors.createError('execucao', 'Limite de passos excedido. Possivel loop infinito.', statement.location);
        }
        if (typeof settings.onStatementStart === 'function') {
            await settings.onStatementStart({
                statement: statement,
                snapshot: snapshotVariables(state.variables)
            });
        }
        ensureCanContinue(state, statement.location);
    }

    function ensureCanContinue(state, location) {
        if (state.stopSignal && state.stopSignal.requested) {
            throw errors.createError('execucao', 'Execucao interrompida pelo usuario.', location);
        }
    }

    async function executeStatement(statement, state, settings) {
        switch (statement.type) {
            case 'AssignmentStatement':
                assignTarget(statement.target, evaluateExpression(statement.expression, state), state);
                return;
            case 'ReadStatement':
                await readIntoTarget(statement.target, state, settings);
                return;
            case 'WriteStatement':
                writeValues(statement, state, settings);
                return;
            case 'IfStatement':
                if (evaluateExpression(statement.condition, state)) {
                    await executeBlock(statement.consequent, state, settings);
                } else if (statement.alternate) {
                    await executeBlock(statement.alternate, state, settings);
                }
                return;
            case 'WhileStatement':
                while (evaluateExpression(statement.condition, state)) {
                    ensureCanContinue(state, statement.location);
                    await executeBlock(statement.body, state, settings);
                }
                return;
            case 'ForStatement':
                await executeFor(statement, state, settings);
                return;
            case 'ChoiceStatement':
                await executeChoice(statement, state, settings);
                return;
            default:
                throw errors.createError('execucao', 'Comando desconhecido na execucao.', statement.location);
        }
    }

    async function executeFor(statement, state, settings) {
        const start = evaluateExpression(statement.startExpr, state);
        const end = evaluateExpression(statement.endExpr, state);
        const step = evaluateExpression(statement.stepExpr, state);

        if (step === 0) {
            throw errors.createError('execucao', 'PASSO 0 nao e permitido.', statement.stepExpr.location);
        }

        setScalar(statement.control.name, start, state);

        const forward = step > 0;
        while (forward ? getScalar(statement.control.name, state) <= end : getScalar(statement.control.name, state) >= end) {
            ensureCanContinue(state, statement.location);
            await executeBlock(statement.body, state, settings);
            setScalar(statement.control.name, getScalar(statement.control.name, state) + step, state);
        }
    }

    async function executeChoice(statement, state, settings) {
        const decision = evaluateExpression(statement.expression, state);
        for (let i = 0; i < statement.cases.length; i += 1) {
            if (evaluateExpression(statement.cases[i].value, state) === decision) {
                await executeBlock(statement.cases[i].body, state, settings);
                return;
            }
        }
        if (statement.otherwise) {
            await executeBlock(statement.otherwise.body, state, settings);
        }
    }

    async function readIntoTarget(target, state, settings) {
        if (typeof settings.read !== 'function') {
            throw errors.createError('execucao', 'Nenhum leitor de entrada foi configurado.', target.location);
        }

        const targetInfo = describeTarget(target, state);
        const raw = await settings.read({
            name: targetInfo.name,
            type: targetInfo.type,
            isVectorElement: target.type === 'IndexAccess',
            location: target.location
        });
        const parsed = parseInput(String(raw == null ? '' : raw), targetInfo.type, target.location);
        assignTarget(target, parsed, state);
    }

    function writeValues(statement, state, settings) {
        let content = '';
        for (let i = 0; i < statement.args.length; i += 1) {
            content += formatValue(evaluateExpression(statement.args[i], state));
        }
        if (statement.newline) {
            content += '\n';
        }
        state.output += content;
        if (typeof settings.write === 'function') {
            settings.write(content);
        }
    }

    function evaluateExpression(expression, state) {
        switch (expression.type) {
            case 'Literal':
                return expression.value;
            case 'Identifier':
                return getScalar(expression.name, state);
            case 'IndexAccess':
                return getIndexedValue(expression.target.name, evaluateExpression(expression.index, state), state, expression.index.location);
            case 'UnaryExpression':
                return evaluateUnary(expression, state);
            case 'BinaryExpression':
                return evaluateBinary(expression, state);
            default:
                throw errors.createError('execucao', 'Expressao nao suportada na execucao.', expression.location);
        }
    }

    function evaluateUnary(expression, state) {
        const value = evaluateExpression(expression.argument, state);
        switch (expression.operator) {
            case 'NAO':
                return !value;
            case '+':
                return +value;
            case '-':
                return -value;
            default:
                throw errors.createError('execucao', 'Operador unario invalido.', expression.location);
        }
    }

    function evaluateBinary(expression, state) {
        const left = evaluateExpression(expression.left, state);
        const right = evaluateExpression(expression.right, state);

        switch (expression.operator) {
            case '+':
                return left + right;
            case '-':
                return left - right;
            case '*':
                return left * right;
            case '/':
                return left / right;
            case '=':
                return left === right;
            case '!=':
                return left !== right;
            case '<':
                return left < right;
            case '<=':
                return left <= right;
            case '>':
                return left > right;
            case '>=':
                return left >= right;
            case 'E':
                return left && right;
            case 'OU':
                return left || right;
            default:
                throw errors.createError('execucao', 'Operador binario invalido.', expression.location);
        }
    }

    function initializeVariables(symbols) {
        const variables = Object.create(null);
        const names = Object.keys(symbols);
        for (let i = 0; i < names.length; i += 1) {
            const symbol = symbols[names[i]];
            if (symbol.isVector) {
                variables[symbol.name] = new Array(symbol.size).fill(defaultValue(symbol.type));
            } else {
                variables[symbol.name] = defaultValue(symbol.type);
            }
        }
        return variables;
    }

    function defaultValue(type) {
        switch (type) {
            case 'REAL':
            case 'INTEIRO':
                return 0;
            case 'CARACTERE':
                return '';
            case 'LOGICO':
                return false;
            default:
                return null;
        }
    }

    function snapshotVariables(variables) {
        const snapshot = Object.create(null);
        const names = Object.keys(variables);
        for (let i = 0; i < names.length; i += 1) {
            const value = variables[names[i]];
            snapshot[names[i]] = Array.isArray(value) ? value.slice() : value;
        }
        return snapshot;
    }

    function describeTarget(target, state) {
        if (target.type === 'Identifier') {
            const symbol = state.symbols[target.name];
            return { name: target.name, type: symbol.type, symbol: symbol };
        }

        const symbol = state.symbols[target.target.name];
        return { name: target.target.name, type: symbol.type, symbol: symbol };
    }

    function assignTarget(target, value, state) {
        if (target.type === 'Identifier') {
            state.variables[target.name] = value;
            return;
        }

        const index = evaluateExpression(target.index, state);
        const safeIndex = validateIndex(target.target.name, index, state, target.index.location);
        state.variables[target.target.name][safeIndex] = value;
    }

    function getScalar(name, state) {
        const symbol = state.symbols[name];
        if (!symbol) {
            throw errors.createError('execucao', 'Variavel nao declarada: ' + name + '.', { line: null, column: null, length: 1, source: '' });
        }
        return state.variables[name];
    }

    function setScalar(name, value, state) {
        state.variables[name] = value;
    }

    function getIndexedValue(name, index, state, location) {
        const safeIndex = validateIndex(name, index, state, location);
        return state.variables[name][safeIndex];
    }

    function validateIndex(name, index, state, location) {
        if (!Number.isInteger(index)) {
            throw errors.createError('execucao', 'Indice de vetor deve ser inteiro.', location);
        }

        const symbol = state.symbols[name];
        if (index < 0 || index >= symbol.size) {
            throw errors.createError('execucao', 'Indice fora do limite do vetor ' + name + '.', location);
        }

        return index;
    }

    function parseInput(rawValue, type, location) {
        const value = rawValue.trim();

        if (type === 'INTEIRO') {
            if (!/^[+-]?\d+$/.test(value)) {
                throw errors.createError('execucao', 'Entrada invalida para INTEIRO.', location);
            }
            return parseInt(value, 10);
        }

        if (type === 'REAL') {
            if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(value)) {
                throw errors.createError('execucao', 'Entrada invalida para REAL.', location);
            }
            return parseFloat(value.replace(',', '.'));
        }

        if (type === 'LOGICO') {
            const upper = value.toUpperCase();
            if (upper === 'VERDADEIRO' || upper === 'TRUE') {
                return true;
            }
            if (upper === 'FALSO' || upper === 'FALSE') {
                return false;
            }
            throw errors.createError('execucao', 'Entrada invalida para LOGICO.', location);
        }

        return rawValue;
    }

    function formatValue(value) {
        if (typeof value === 'boolean') {
            return value ? 'VERDADEIRO' : 'FALSO';
        }
        if (value == null) {
            return '';
        }
        return String(value);
    }

    return {
        execute
    };
}));
