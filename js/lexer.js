(function (root, factory) {
    const api = factory(root);
    root.DevCode = root.DevCode || {};
    root.DevCode.lexer = api;

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

    const SYMBOLS = new Set(['(', ')', '[', ']', ',', ':', '+', '-', '*', '/', '<', '>', '=', '<-', '<=', '>=', '!=']);

    function createToken(type, lexeme, value, line, column, source) {
        return {
            type,
            lexeme,
            value,
            line,
            column,
            length: lexeme.length || 1,
            source: source || ''
        };
    }

    function tokenize(input) {
        const source = String(input == null ? '' : input).replace(/\r\n?/g, '\n');
        const lines = source.split('\n');
        const tokens = [];
        let index = 0;
        let line = 1;
        let column = 1;

        function current() {
            return source[index];
        }

        function peek(offset) {
            return source[index + (offset || 0)];
        }

        function currentLineText(targetLine) {
            return lines[(targetLine || line) - 1] || '';
        }

        function advance() {
            const ch = source[index++];
            if (ch === '\n') {
                line += 1;
                column = 1;
            } else {
                column += 1;
            }
            return ch;
        }

        function isDigit(ch) {
            return ch >= '0' && ch <= '9';
        }

        function isIdentifierStart(ch) {
            return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_';
        }

        function isIdentifierPart(ch) {
            return isIdentifierStart(ch) || isDigit(ch);
        }

        while (index < source.length) {
            const ch = current();

            if (ch === ' ' || ch === '\t') {
                advance();
                continue;
            }

            if (ch === '\n') {
                tokens.push(createToken('NEWLINE', '\n', '\n', line, column, currentLineText()));
                advance();
                continue;
            }

            if (ch === '/' && peek(1) === '/') {
                while (index < source.length && current() !== '\n') {
                    advance();
                }
                continue;
            }

            if (ch === '"') {
                const startLine = line;
                const startColumn = column;
                let lexeme = advance();
                let value = '';
                let closed = false;

                while (index < source.length) {
                    const char = current();
                    if (char === '\n') {
                        break;
                    }

                    if (char === '\\') {
                        lexeme += advance();
                        const escaped = current();
                        if (escaped == null) {
                            break;
                        }
                        lexeme += advance();
                        if (escaped === 'n') {
                            value += '\n';
                        } else if (escaped === 't') {
                            value += '\t';
                        } else {
                            value += escaped;
                        }
                        continue;
                    }

                    lexeme += advance();
                    if (char === '"') {
                        closed = true;
                        break;
                    }
                    value += char;
                }

                if (!closed) {
                    throw errors.createError(
                        'lexico',
                        'String nao foi finalizada.',
                        { line: startLine, column: startColumn, length: Math.max(1, lexeme.length), source: currentLineText(startLine) }
                    );
                }

                tokens.push(createToken('STRING', lexeme, value, startLine, startColumn, currentLineText(startLine)));
                continue;
            }

            if (isDigit(ch)) {
                const startLine = line;
                const startColumn = column;
                let lexeme = '';
                let hasDot = false;

                while (index < source.length) {
                    const char = current();
                    if (isDigit(char)) {
                        lexeme += advance();
                        continue;
                    }

                    if (char === '.' && !hasDot && isDigit(peek(1))) {
                        hasDot = true;
                        lexeme += advance();
                        continue;
                    }

                    break;
                }

                tokens.push(createToken(
                    'NUMBER',
                    lexeme,
                    hasDot ? parseFloat(lexeme) : parseInt(lexeme, 10),
                    startLine,
                    startColumn,
                    currentLineText(startLine)
                ));
                continue;
            }

            if (isIdentifierStart(ch)) {
                const startLine = line;
                const startColumn = column;
                let lexeme = '';

                while (index < source.length && isIdentifierPart(current())) {
                    lexeme += advance();
                }

                const upper = lexeme.toUpperCase();
                if (language.KEYWORDS.indexOf(upper) !== -1) {
                    tokens.push(createToken('KEYWORD', lexeme, upper, startLine, startColumn, currentLineText(startLine)));
                } else {
                    tokens.push(createToken('IDENTIFIER', lexeme, lexeme, startLine, startColumn, currentLineText(startLine)));
                }
                continue;
            }

            const pair = ch + (peek(1) || '');
            if (pair === '<>') {
                throw errors.createError(
                    'lexico',
                    'Operador de diferente invalido. Use !=.',
                    { line: line, column: column, length: 2, source: currentLineText() }
                );
            }
            if (SYMBOLS.has(pair)) {
                tokens.push(createToken('SYMBOL', pair, pair, line, column, currentLineText()));
                advance();
                advance();
                continue;
            }

            if (SYMBOLS.has(ch)) {
                tokens.push(createToken('SYMBOL', ch, ch, line, column, currentLineText()));
                advance();
                continue;
            }

            throw errors.createError(
                'lexico',
                'Token invalido encontrado.',
                { line: line, column: column, length: 1, source: currentLineText() }
            );
        }

        tokens.push(createToken('EOF', '', '', line, column, currentLineText()));

        return {
            source,
            lines,
            tokens
        };
    }

    return {
        tokenize
    };
}));
