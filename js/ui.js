(function (root, factory) {
    const api = factory(root);
    root.DevCode = root.DevCode || {};
    root.DevCode.ui = api;

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    const errors = root.DevCode && root.DevCode.errors
        ? root.DevCode.errors
        : require('./errors.js');

    function UIController(elements) {
        this.outputArea = elements.outputArea;
        this.consoleContainer = elements.consoleContainer;
        this.inputPanel = elements.inputPanel;
        this.inputLabel = elements.inputLabel;
        this.inputField = elements.inputField;
        this.statusBadge = elements.statusBadge;
        this.statusText = elements.statusText;
        this.analysisSummary = elements.analysisSummary;
        this.analysisMeta = elements.analysisMeta;
        this.errorSummary = elements.errorSummary;
        this.errorDetails = elements.errorDetails;
        this.errorSource = elements.errorSource;
        this.variablesView = elements.variablesView;
        this.specSections = elements.specSections;
        this.specGrammar = elements.specGrammar;
        this.specLimits = elements.specLimits;
        this.pendingInput = null;
    }

    UIController.prototype.print = function (text, tone) {
        const chunk = document.createElement('span');
        chunk.className = 'console-chunk tone-' + (tone || 'system');
        chunk.textContent = String(text);
        this.outputArea.appendChild(chunk);
        this.consoleContainer.scrollTop = this.consoleContainer.scrollHeight;
    };

    UIController.prototype.clearConsole = function () {
        this.outputArea.innerHTML = '';
        this.dismissInput();
    };

    UIController.prototype.setStatus = function (state, text) {
        this.statusBadge.dataset.state = state;
        this.statusText.textContent = text;
    };

    UIController.prototype.renderAnalysis = function (compilation) {
        const declarationCount = compilation.ast.declarations.length;
        const statementCount = compilation.ast.body.length;
        const tokenCount = compilation.tokens.filter(function (token) {
            return token.type !== 'NEWLINE' && token.type !== 'EOF';
        }).length;

        this.analysisSummary.textContent = 'Analise concluida com lexer, parser, semantica e runtime isolados.';
        this.analysisMeta.textContent = declarationCount
            + ' declaracoes, '
            + statementCount
            + ' comandos de topo e '
            + tokenCount
            + ' tokens validos.';
    };

    UIController.prototype.renderAnalysisFailure = function (formattedError) {
        this.analysisSummary.textContent = 'Analise interrompida por erro ' + formattedError.kind + '.';
        if (formattedError.line) {
            this.analysisMeta.textContent = 'Falha na linha ' + formattedError.line + ', coluna ' + (formattedError.column || 1) + '.';
        } else {
            this.analysisMeta.textContent = 'Falha sem localizacao detalhada.';
        }
    };

    UIController.prototype.renderError = function (formattedError) {
        if (!formattedError) {
            this.errorSummary.textContent = 'Nenhum erro na ultima analise.';
            this.errorDetails.textContent = 'Tudo pronto para validar ou executar.';
            this.errorSource.textContent = '';
            return;
        }

        const position = formattedError.line
            ? 'Linha ' + formattedError.line + ', coluna ' + (formattedError.column || 1)
            : 'Sem posicao detalhada';

        this.errorSummary.textContent = 'Erro ' + formattedError.kind;
        this.errorDetails.textContent = position + ' - ' + formattedError.message;
        this.errorSource.textContent = formattedError.source || '';
    };

    UIController.prototype.renderVariables = function (snapshot) {
        const names = Object.keys(snapshot || {});
        if (names.length === 0) {
            this.variablesView.textContent = 'Nenhuma variavel disponivel.';
            return;
        }

        const lines = names.map(function (name) {
            const value = snapshot[name];
            if (Array.isArray(value)) {
                return name + ' = [' + value.map(formatValue).join(', ') + ']';
            }
            return name + ' = ' + formatValue(value);
        });
        this.variablesView.textContent = lines.join('\n');
    };

    UIController.prototype.renderSpec = function (spec) {
        renderList(this.specSections, spec.sections);
        renderList(this.specGrammar, spec.grammar);
        renderList(this.specLimits, spec.mvpLimits);
    };

    UIController.prototype.requestInput = function (meta, stopSignal) {
        const self = this;
        this.dismissInput();
        this.inputPanel.hidden = false;
        this.inputLabel.textContent = 'LEIA ' + meta.name + ' : ' + meta.type;
        this.inputField.value = '';
        this.inputField.focus();

        return new Promise(function (resolve, reject) {
            let intervalId = null;

            function cleanup() {
                self.inputField.removeEventListener('keydown', onKeyDown);
                self.inputPanel.hidden = true;
                if (intervalId) {
                    clearInterval(intervalId);
                }
                self.pendingInput = null;
            }

            function onKeyDown(event) {
                if (event.key === 'Enter') {
                    const value = self.inputField.value;
                    cleanup();
                    self.print('> ' + value + '\n', 'user');
                    resolve(value);
                }
            }

            intervalId = setInterval(function () {
                if (stopSignal && stopSignal.requested) {
                    cleanup();
                    reject(errors.createError('execucao', 'Execucao interrompida pelo usuario.', meta.location));
                }
            }, 120);

            self.pendingInput = {
                reject: reject,
                cleanup: cleanup
            };

            self.inputField.addEventListener('keydown', onKeyDown);
        });
    };

    UIController.prototype.dismissInput = function () {
        if (this.pendingInput) {
            this.pendingInput.cleanup();
        }
    };

    UIController.prototype.cancelPendingInput = function (message) {
        if (this.pendingInput) {
            const pending = this.pendingInput;
            pending.cleanup();
            pending.reject(errors.createError('execucao', message || 'Execucao interrompida pelo usuario.', { line: null, column: null, length: 1, source: '' }));
        }
    };

    function renderList(element, items) {
        element.innerHTML = '';
        for (let i = 0; i < items.length; i += 1) {
            const item = document.createElement('li');
            item.textContent = items[i];
            element.appendChild(item);
        }
    }

    function formatValue(value) {
        if (typeof value === 'boolean') {
            return value ? 'VERDADEIRO' : 'FALSO';
        }
        return String(value);
    }

    return {
        UIController
    };
}));
