(function (root) {
    function init() {
        const editor = new root.DevCode.editor.EditorController({
            textarea: document.getElementById('editor'),
            highlightLayer: document.getElementById('highlight-layer'),
            lineNumbers: document.getElementById('line-numbers'),
            activeLine: document.getElementById('active-line-highlight'),
            errorLine: document.getElementById('error-line-highlight'),
            executionLine: document.getElementById('execution-line-highlight'),
            cursorIndicator: document.getElementById('cursor-indicator')
        }, {
            onChange: function () {
                editor.clearError();
                ui.renderError(null);
                ui.setStatus(state.running ? 'running' : 'idle', state.running ? 'Executando' : 'Pronto');
            }
        });

        const ui = new root.DevCode.ui.UIController({
            outputArea: document.getElementById('output-area'),
            consoleContainer: document.getElementById('console-container'),
            inputPanel: document.getElementById('input-panel'),
            inputLabel: document.getElementById('input-label'),
            inputField: document.getElementById('console-input'),
            statusBadge: document.getElementById('status-badge'),
            statusText: document.getElementById('status-text'),
            analysisSummary: document.getElementById('analysis-summary'),
            analysisMeta: document.getElementById('analysis-meta'),
            errorSummary: document.getElementById('error-summary'),
            errorDetails: document.getElementById('error-details'),
            errorSource: document.getElementById('error-source'),
            variablesView: document.getElementById('variables-view'),
            specSections: document.getElementById('spec-sections'),
            specGrammar: document.getElementById('spec-grammar'),
            specLimits: document.getElementById('spec-limits')
        });

        const compiler = root.DevCode.compiler;
        const runtime = root.DevCode.runtime;
        const errors = root.DevCode.errors;
        const language = root.DevCode.language;

        const runButton = document.getElementById('run-btn');
        const stepButton = document.getElementById('step-btn');
        const stopButton = document.getElementById('stop-btn');
        const validateButton = document.getElementById('validate-btn');
        const formatButton = document.getElementById('format-btn');
        const clearConsoleButton = document.getElementById('clear-console-btn');
        const saveFileButton = document.getElementById('save-file-btn');
        const loadFileButton = document.getElementById('load-file-btn');
        const fileInput = document.getElementById('file-input');
        const exampleSelect = document.getElementById('example-select');
        const searchInput = document.getElementById('search-input');
        const searchButton = document.getElementById('search-btn');
        const snippetHost = document.getElementById('snippet-bar');
        const helpToggle = document.getElementById('help-toggle');
        const helpModal = document.getElementById('reference-modal');
        const helpClose = document.getElementById('reference-close-btn');
        const referenceList = document.getElementById('reference-list');

        const state = {
            running: false,
            stepMode: false,
            stopSignal: null,
            pendingStepResolver: null
        };

        ui.renderSpec(language.LANGUAGE_SPEC);
        renderExamples(exampleSelect, language.SAMPLE_PROGRAMS);
        renderSnippets(snippetHost, language.SNIPPETS, editor);
        renderReferenceGuide(referenceList, language.REFERENCE_GUIDE);
        editor.setValue(language.SAMPLE_PROGRAMS[0].source);
        ui.renderError(null);
        ui.renderVariables({});
        ui.setStatus('idle', 'Pronto');
        updateButtons();
        validateSilently();

        runButton.addEventListener('click', function () {
            if (!state.running) {
                startExecution(false);
            }
        });

        stepButton.addEventListener('click', function () {
            if (!state.running) {
                startExecution(true);
                return;
            }
            if (state.stepMode && state.pendingStepResolver) {
                const resume = state.pendingStepResolver;
                state.pendingStepResolver = null;
                ui.setStatus('running', 'Executando proximo passo');
                resume();
            }
        });

        stopButton.addEventListener('click', function () {
            stopExecution();
        });

        validateButton.addEventListener('click', function () {
            validateNow(true);
        });

        formatButton.addEventListener('click', function () {
            try {
                editor.setValue(compiler.formatSource(editor.getValue()));
                validateNow(true);
            } catch (error) {
                handleFailure(error, true);
            }
        });

        clearConsoleButton.addEventListener('click', function () {
            ui.clearConsole();
        });

        saveFileButton.addEventListener('click', function () {
            const blob = new Blob([editor.getValue()], { type: 'text/plain;charset=utf-8' });
            const anchor = document.createElement('a');
            anchor.href = URL.createObjectURL(blob);
            anchor.download = 'main.por';
            anchor.click();
            setTimeout(function () {
                URL.revokeObjectURL(anchor.href);
            }, 0);
        });

        loadFileButton.addEventListener('click', function () {
            fileInput.click();
        });

        fileInput.addEventListener('change', function (event) {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = function () {
                editor.setValue(String(reader.result || ''));
                validateSilently();
            };
            reader.readAsText(file);
            fileInput.value = '';
        });

        exampleSelect.addEventListener('change', function () {
            const selected = language.SAMPLE_PROGRAMS.find(function (item) {
                return item.id === exampleSelect.value;
            });
            if (selected) {
                editor.setValue(selected.source);
                ui.clearConsole();
                validateSilently();
            }
        });

        searchButton.addEventListener('click', function () {
            const found = editor.findNext(searchInput.value);
            if (!found && searchInput.value.trim()) {
                ui.print('\n[Busca] Termo nao encontrado: ' + searchInput.value + '\n', 'info');
            }
        });

        searchInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                searchButton.click();
            }
        });

        helpToggle.addEventListener('click', function () {
            helpModal.hidden = false;
            document.body.classList.add('is-modal-open');
        });

        helpClose.addEventListener('click', function () {
            closeReferenceGuide();
        });

        helpModal.addEventListener('click', function (event) {
            if (event.target === helpModal) {
                closeReferenceGuide();
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !helpModal.hidden) {
                closeReferenceGuide();
            }
        });

        async function startExecution(stepMode) {
            if (state.running) {
                return;
            }

            ui.clearConsole();
            editor.clearError();
            editor.clearExecutionLine();
            ui.renderVariables({});

            let compilation;
            try {
                compilation = compiler.validateSource(editor.getValue());
                ui.renderAnalysis(compilation);
                ui.renderError(null);
            } catch (error) {
                handleFailure(error, true);
                return;
            }

            state.running = true;
            state.stepMode = stepMode;
            state.stopSignal = { requested: false };
            state.pendingStepResolver = null;
            updateButtons();
            ui.setStatus(stepMode ? 'stepping' : 'running', stepMode ? 'Passo a passo ativo' : 'Executando');

            try {
                const execution = await runtime.execute(compilation.ast, {
                    maxSteps: 25000,
                    stopSignal: state.stopSignal,
                    write: function (chunk) {
                        if (chunk && chunk !== '\n') {
                            ui.print(chunk.replace(/\n$/, ''), 'system');
                        }
                    },
                    read: function (meta) {
                        return ui.requestInput(meta, state.stopSignal);
                    },
                    onStatementStart: function (payload) {
                        editor.setExecutionLine(payload.statement.location.line);
                        ui.renderVariables(payload.snapshot);
                        if (!state.stepMode) {
                            return Promise.resolve();
                        }
                        ui.setStatus('stepping', 'Aguardando proximo passo');
                        return new Promise(function (resolve) {
                            state.pendingStepResolver = resolve;
                        });
                    },
                    onStatementEnd: function (payload) {
                        ui.renderVariables(payload.snapshot);
                    }
                });

                ui.renderVariables(execution.variables);
                ui.print('\n[Programa finalizado em ' + execution.steps + ' passos]\n', 'info');
                ui.setStatus('success', 'Execucao concluida');
            } catch (error) {
                handleFailure(error, true);
            } finally {
                state.running = false;
                state.stepMode = false;
                state.stopSignal = null;
                state.pendingStepResolver = null;
                editor.clearExecutionLine();
                updateButtons();
            }
        }

        function stopExecution() {
            if (!state.running || !state.stopSignal) {
                return;
            }
            state.stopSignal.requested = true;
            ui.cancelPendingInput('Execucao interrompida pelo usuario.');
            if (state.pendingStepResolver) {
                const resume = state.pendingStepResolver;
                state.pendingStepResolver = null;
                resume();
            }
        }

        function validateSilently() {
            try {
                const compilation = compiler.validateSource(editor.getValue());
                ui.renderAnalysis(compilation);
                ui.renderError(null);
                editor.clearError();
            } catch (error) {
                const formatted = errors.formatError(error);
                ui.renderAnalysisFailure(formatted);
                ui.renderError(formatted);
                editor.markError(formatted.line || null);
            }
        }

        function validateNow(printToConsole) {
            ui.clearConsole();
            try {
                const compilation = compiler.validateSource(editor.getValue());
                ui.renderAnalysis(compilation);
                ui.renderError(null);
                editor.clearError();
                ui.setStatus('success', 'Codigo validado');
                if (printToConsole) {
                    ui.print('\n[Validacao] Nenhum erro encontrado.\n', 'info');
                }
            } catch (error) {
                handleFailure(error, printToConsole);
            }
        }

        function handleFailure(error, printToConsole) {
            const formatted = errors.formatError(error);
            if (formatted.kind !== 'execucao') {
                ui.renderAnalysisFailure(formatted);
            }
            editor.markError(formatted.line || null);
            ui.renderError(formatted);
            ui.setStatus('error', 'Erro encontrado');
            if (printToConsole) {
                ui.print('\n[Erro] ' + buildErrorText(formatted) + '\n', 'error');
            }
        }

        function updateButtons() {
            runButton.disabled = state.running;
            validateButton.disabled = state.running;
            formatButton.disabled = state.running;
            stopButton.disabled = !state.running;
            stepButton.textContent = state.running && state.stepMode ? 'Proximo passo' : 'Passo a passo';
        }

        function buildErrorText(formatted) {
            if (formatted.line) {
                return formatted.kind + ' na linha ' + formatted.line + ', coluna ' + (formatted.column || 1) + ': ' + formatted.message;
            }
            return formatted.kind + ': ' + formatted.message;
        }

        function closeReferenceGuide() {
            helpModal.hidden = true;
            document.body.classList.remove('is-modal-open');
        }
    }

    function renderExamples(select, examples) {
        select.innerHTML = '';
        for (let i = 0; i < examples.length; i += 1) {
            const option = document.createElement('option');
            option.value = examples[i].id;
            option.textContent = examples[i].title + ' - ' + examples[i].description;
            select.appendChild(option);
        }
    }

    function renderSnippets(host, snippets, editor) {
        host.innerHTML = '';
        for (let i = 0; i < snippets.length; i += 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'snippet-chip';
            button.textContent = snippets[i].label;
            button.addEventListener('click', function () {
                editor.insertSnippet(snippets[i].content);
            });
            host.appendChild(button);
        }
    }

    function renderReferenceGuide(host, entries) {
        host.innerHTML = '';
        for (let i = 0; i < entries.length; i += 1) {
            const article = document.createElement('article');
            article.className = 'reference-entry';
            article.innerHTML = [
                '<h3>' + escapeHtml(entries[i].title) + '</h3>',
                '<p><strong>Sintaxe:</strong> ' + escapeHtml(entries[i].syntax) + '</p>',
                '<p><strong>Exemplo:</strong></p>',
                '<pre>' + escapeHtml(entries[i].example) + '</pre>'
            ].join('');
            host.appendChild(article);
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this));
