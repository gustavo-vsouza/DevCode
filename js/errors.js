(function (root, factory) {
    const api = factory(root);
    root.DevCode = root.DevCode || {};
    root.DevCode.errors = api;

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    class DevCodeError extends Error {
        constructor(kind, message, location, details) {
            super(message);
            this.name = 'DevCodeError';
            this.kind = kind;
            this.line = location && typeof location.line === 'number' ? location.line : null;
            this.column = location && typeof location.column === 'number' ? location.column : null;
            this.length = location && typeof location.length === 'number' ? location.length : 1;
            this.source = location && typeof location.source === 'string' ? location.source : '';
            this.details = details || {};
        }
    }

    function toLocation(tokenOrLocation) {
        if (!tokenOrLocation) {
            return { line: null, column: null, length: 1, source: '' };
        }

        return {
            line: typeof tokenOrLocation.line === 'number' ? tokenOrLocation.line : null,
            column: typeof tokenOrLocation.column === 'number' ? tokenOrLocation.column : null,
            length: typeof tokenOrLocation.length === 'number'
                ? tokenOrLocation.length
                : (tokenOrLocation.lexeme ? tokenOrLocation.lexeme.length : 1),
            source: typeof tokenOrLocation.source === 'string' ? tokenOrLocation.source : ''
        };
    }

    function createError(kind, message, tokenOrLocation, details) {
        return new DevCodeError(kind, message, toLocation(tokenOrLocation), details);
    }

    function formatError(error) {
        if (!(error instanceof DevCodeError)) {
            return {
                kind: 'interno',
                message: error && error.message ? error.message : String(error),
                line: null,
                column: null,
                length: 1,
                source: ''
            };
        }

        return {
            kind: error.kind,
            message: error.message,
            line: error.line,
            column: error.column,
            length: error.length,
            source: error.source
        };
    }

    return {
        DevCodeError,
        createError,
        formatError,
        toLocation
    };
}));
