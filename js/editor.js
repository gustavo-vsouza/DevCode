(function (root, factory) {
    const api = factory(root);
    root.DevCode = root.DevCode || {};
    root.DevCode.editor = api;

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    const language = root.DevCode && root.DevCode.language
        ? root.DevCode.language
        : require('./language.js');

    function EditorController(elements, options) {
        this.textarea = elements.textarea;
        this.highlightLayer = elements.highlightLayer;
        this.lineNumbers = elements.lineNumbers;
        this.activeLine = elements.activeLine;
        this.errorLine = elements.errorLine;
        this.executionLine = elements.executionLine;
        this.cursorIndicator = elements.cursorIndicator;
        this.handlers = options || {};
        this.currentErrorLine = null;
        this.currentExecutionLine = null;
        this.bindEvents();
        this.refresh();
    }

    EditorController.prototype.bindEvents = function () {
        const self = this;

        this.textarea.addEventListener('input', function () {
            self.refresh();
            if (typeof self.handlers.onChange === 'function') {
                self.handlers.onChange(self.getValue());
            }
        });

        this.textarea.addEventListener('scroll', function () {
            self.syncScroll();
            self.updateDecorations();
        });

        this.textarea.addEventListener('click', function () {
            self.updateCursor();
            self.updateDecorations();
        });

        this.textarea.addEventListener('keyup', function () {
            self.updateCursor();
            self.updateDecorations();
        });

        this.textarea.addEventListener('keydown', function (event) {
            self.handleKeyDown(event);
        });
    };

    EditorController.prototype.handleKeyDown = function (event) {
        const pairs = {
            '"': '"',
            '(': ')',
            '[': ']'
        };

        if (event.key === 'Tab') {
            event.preventDefault();
            this.replaceSelection('    ');
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            const selectionStart = this.textarea.selectionStart;
            const value = this.getValue();
            const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
            const lineText = value.slice(lineStart, selectionStart);
            const indent = (lineText.match(/^\s*/) || [''])[0];
            const trimmed = lineText.trim();
            const shouldIndentMore = /(?:ENTAO|FACA)\s*$/i.test(trimmed) || /^(?:CASO\b.+:|OUTROCASO:)\s*$/i.test(trimmed);
            this.replaceSelection('\n' + indent + (shouldIndentMore ? '    ' : ''));
            return;
        }

        if (Object.prototype.hasOwnProperty.call(pairs, event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            const selection = this.getSelection();
            if (selection.text.length > 0) {
                this.replaceSelection(event.key + selection.text + pairs[event.key], selection.start + 1, selection.end + 1);
            } else {
                this.replaceSelection(event.key + pairs[event.key], selection.start + 1, selection.start + 1);
            }
        }
    };

    EditorController.prototype.getSelection = function () {
        return {
            start: this.textarea.selectionStart,
            end: this.textarea.selectionEnd,
            text: this.textarea.value.slice(this.textarea.selectionStart, this.textarea.selectionEnd)
        };
    };

    EditorController.prototype.replaceSelection = function (content, nextStart, nextEnd) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.getValue();
        this.textarea.value = value.slice(0, start) + content + value.slice(end);
        const targetStart = typeof nextStart === 'number' ? nextStart : start + content.length;
        const targetEnd = typeof nextEnd === 'number' ? nextEnd : targetStart;
        this.textarea.selectionStart = targetStart;
        this.textarea.selectionEnd = targetEnd;
        this.refresh();
        if (typeof this.handlers.onChange === 'function') {
            this.handlers.onChange(this.getValue());
        }
    };

    EditorController.prototype.insertSnippet = function (content) {
        const selection = this.getSelection();
        const prefix = selection.start > 0 && this.textarea.value[selection.start - 1] !== '\n' ? '\n' : '';
        const suffix = selection.end < this.textarea.value.length && this.textarea.value[selection.end] !== '\n' ? '\n' : '';
        this.replaceSelection(prefix + content + suffix);
        this.focus();
    };

    EditorController.prototype.refresh = function () {
        this.updateHighlight();
        this.updateLineNumbers();
        this.syncScroll();
        this.updateCursor();
        this.updateDecorations();
    };

    EditorController.prototype.updateHighlight = function () {
        const source = this.getValue();
        this.highlightLayer.innerHTML = highlightSource(source) + (source.endsWith('\n') ? ' ' : '');
    };

    EditorController.prototype.updateLineNumbers = function () {
        const total = Math.max(1, this.getLineCount());
        const active = this.getCurrentLine();
        const errorLine = this.currentErrorLine;
        const executionLine = this.currentExecutionLine;
        const parts = [];

        for (let line = 1; line <= total; line += 1) {
            const classNames = ['line-number'];
            if (line === active) classNames.push('is-active');
            if (line === errorLine) classNames.push('is-error');
            if (line === executionLine) classNames.push('is-executing');
            parts.push('<span class="' + classNames.join(' ') + '">' + line + '</span>');
        }

        this.lineNumbers.innerHTML = parts.join('');
    };

    EditorController.prototype.updateCursor = function () {
        const start = this.textarea.selectionStart;
        const before = this.textarea.value.slice(0, start);
        const line = before.split('\n').length;
        const column = before.length - before.lastIndexOf('\n');
        this.cursorIndicator.textContent = 'Ln ' + line + ', Col ' + column;
    };

    EditorController.prototype.updateDecorations = function () {
        const lineHeight = parseFloat(getComputedStyle(this.textarea).lineHeight) || 24;
        const scrollTop = this.textarea.scrollTop;
        positionHighlight(this.activeLine, this.getCurrentLine(), lineHeight, scrollTop);
        positionHighlight(this.errorLine, this.currentErrorLine, lineHeight, scrollTop);
        positionHighlight(this.executionLine, this.currentExecutionLine, lineHeight, scrollTop);
    };

    EditorController.prototype.syncScroll = function () {
        this.highlightLayer.scrollTop = this.textarea.scrollTop;
        this.highlightLayer.scrollLeft = this.textarea.scrollLeft;
        this.lineNumbers.scrollTop = this.textarea.scrollTop;
    };

    EditorController.prototype.getCurrentLine = function () {
        return this.textarea.value.slice(0, this.textarea.selectionStart).split('\n').length;
    };

    EditorController.prototype.getLineCount = function () {
        return this.textarea.value.split('\n').length;
    };

    EditorController.prototype.getValue = function () {
        return this.textarea.value;
    };

    EditorController.prototype.setValue = function (value) {
        this.textarea.value = value;
        this.refresh();
    };

    EditorController.prototype.focus = function () {
        this.textarea.focus();
    };

    EditorController.prototype.markError = function (line) {
        this.currentErrorLine = line || null;
        this.updateLineNumbers();
        this.updateDecorations();
    };

    EditorController.prototype.clearError = function () {
        this.currentErrorLine = null;
        this.updateLineNumbers();
        this.updateDecorations();
    };

    EditorController.prototype.setExecutionLine = function (line) {
        this.currentExecutionLine = line || null;
        this.updateLineNumbers();
        this.updateDecorations();
    };

    EditorController.prototype.clearExecutionLine = function () {
        this.currentExecutionLine = null;
        this.updateLineNumbers();
        this.updateDecorations();
    };

    EditorController.prototype.findNext = function (query) {
        const term = String(query || '');
        if (!term) {
            return false;
        }

        const content = this.getValue().toLowerCase();
        const lookup = term.toLowerCase();
        const start = this.textarea.selectionEnd;
        let index = content.indexOf(lookup, start);
        if (index === -1) {
            index = content.indexOf(lookup, 0);
        }
        if (index === -1) {
            return false;
        }

        this.textarea.focus();
        this.textarea.selectionStart = index;
        this.textarea.selectionEnd = index + term.length;
        this.updateCursor();
        this.updateDecorations();
        return true;
    };

    function positionHighlight(element, line, lineHeight, scrollTop) {
        if (!line) {
            element.style.display = 'none';
            return;
        }
        element.style.display = 'block';
        element.style.height = lineHeight + 'px';
        element.style.transform = 'translateY(' + (((line - 1) * lineHeight) - scrollTop) + 'px)';
    }

    function highlightSource(source) {
        if (!source) {
            return '';
        }

        const types = ['INTEIRO', 'REAL', 'CARACTERE', 'LOGICO', 'VETOR'];
        const reserved = language.KEYWORDS.filter(function (keyword) {
            return types.indexOf(keyword) === -1 && keyword !== 'VERDADEIRO' && keyword !== 'FALSO';
        });

        const pattern = new RegExp(
            '(//.*$)|' +
            '("([^"\\\\]|\\\\.)*")|' +
            '\\b(' + types.join('|') + ')\\b|' +
            '\\b(VERDADEIRO|FALSO)\\b|' +
            '\\b(' + reserved.join('|') + ')\\b|' +
            '(<-|!=|<=|>=|=|\\+|-|\\*|\\/|\\bE\\b|\\bOU\\b|\\bNAO\\b|<|>)|' +
            '\\b(\\d+(?:\\.\\d+)?)\\b',
            'gim'
        );

        let html = '';
        let cursor = 0;
        let match;

        while ((match = pattern.exec(source)) !== null) {
            html += escapeHtml(source.slice(cursor, match.index));
            if (match[1]) {
                html += '<span class="token-comment">' + escapeHtml(match[1]) + '</span>';
            } else if (match[2]) {
                html += '<span class="token-string">' + escapeHtml(match[2]) + '</span>';
            } else if (match[4]) {
                html += '<span class="token-type">' + escapeHtml(match[4].toUpperCase()) + '</span>';
            } else if (match[5]) {
                html += '<span class="token-boolean">' + escapeHtml(match[5].toUpperCase()) + '</span>';
            } else if (match[6]) {
                html += '<span class="token-keyword">' + escapeHtml(match[6].toUpperCase()) + '</span>';
            } else if (match[7]) {
                html += '<span class="token-operator">' + escapeHtml(match[7].toUpperCase()) + '</span>';
            } else if (match[8]) {
                html += '<span class="token-number">' + escapeHtml(match[8]) + '</span>';
            }
            cursor = pattern.lastIndex;
        }

        html += escapeHtml(source.slice(cursor));
        return html;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    return {
        EditorController
    };
}));
