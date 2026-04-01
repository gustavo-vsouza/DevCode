import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const compiler = require('../js/compiler.js');
const errors = require('../js/errors.js');

test('executa comparacao com operador diferente convencional', async () => {
    const source = [
        'DECLARE',
        'a, b: INTEIRO',
        'resultado: LOGICO',
        'INICIO',
        'a <- 10',
        'b <- 4',
        'resultado <- a != b',
        'ESCREVAL resultado',
        'FIM'
    ].join('\n');

    const run = await compiler.runSource(source, {
        write: () => {},
        read: async () => '0'
    });

    assert.equal(run.execution.output.trim(), 'VERDADEIRO');
});

test('impede uso de variavel nao declarada', () => {
    const source = [
        'DECLARE',
        'valor: INTEIRO',
        'INICIO',
        'total <- 5',
        'FIM'
    ].join('\n');

    assert.throws(
        () => compiler.validateSource(source),
        (error) => {
            const formatted = errors.formatError(error);
            return formatted.kind === 'semantico' && /nao declarada/i.test(formatted.message);
        }
    );
});

test('rejeita passo zero no PARA', () => {
    const source = [
        'DECLARE',
        'i: INTEIRO',
        'INICIO',
        'PARA i DE 0 ATE 5 PASSO 0 FACA',
        '    ESCREVAL i',
        'FIMPARA',
        'FIM'
    ].join('\n');

    assert.throws(
        () => compiler.validateSource(source),
        (error) => {
            const formatted = errors.formatError(error);
            return formatted.kind === 'semantico' && /PASSO 0/i.test(formatted.message);
        }
    );
});

test('detecta acesso fora do limite do vetor em indice constante', () => {
    const source = [
        'DECLARE',
        'notas: VETOR[2] DE REAL',
        'INICIO',
        'notas[2] <- 7',
        'FIM'
    ].join('\n');

    assert.throws(
        () => compiler.validateSource(source),
        (error) => {
            const formatted = errors.formatError(error);
            return formatted.kind === 'semantico' && /fora do limite/i.test(formatted.message);
        }
    );
});

test('rejeita operador legado de diferente', () => {
    const source = [
        'DECLARE',
        'a, b: INTEIRO',
        'resultado: LOGICO',
        'INICIO',
        'resultado <- a <> b',
        'FIM'
    ].join('\n');

    assert.throws(
        () => compiler.validateSource(source),
        (error) => {
            const formatted = errors.formatError(error);
            return formatted.kind === 'lexico';
        }
    );
});

test('formata programa mantendo sintaxe oficial', () => {
    const source = [
        'DECLARE',
        'a,b:INTEIRO',
        'INICIO',
        'SE a!=b ENTAO',
        'ESCREVAL "ok"',
        'FIMSE',
        'FIM'
    ].join('\n');

    const formatted = compiler.formatSource(source);

    assert.match(formatted, /a, b: INTEIRO/);
    assert.match(formatted, /SE a != b ENTAO/);
});
