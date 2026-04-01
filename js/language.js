(function (root, factory) {
    const api = factory(root);
    root.DevCode = root.DevCode || {};
    root.DevCode.language = api;

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const KEYWORDS = Object.freeze([
        'ALGORITMO',
        'DECLARE',
        'INICIO',
        'FIM',
        'ESCREVA',
        'ESCREVAL',
        'LEIA',
        'SE',
        'ENTAO',
        'SENAO',
        'FIMSE',
        'ENQUANTO',
        'FACA',
        'FIMENQUANTO',
        'PARA',
        'DE',
        'ATE',
        'PASSO',
        'FIMPARA',
        'ESCOLHA',
        'CASO',
        'OUTROCASO',
        'FIMESCOLHA',
        'VETOR',
        'INTEIRO',
        'REAL',
        'CARACTERE',
        'LOGICO',
        'VERDADEIRO',
        'FALSO',
        'E',
        'OU',
        'NAO'
    ]);

    const BASE_TYPES = Object.freeze(['INTEIRO', 'REAL', 'CARACTERE', 'LOGICO']);
    const NUMERIC_TYPES = Object.freeze(['INTEIRO', 'REAL']);

    const OPERATOR_PRECEDENCE = Object.freeze({
        OU: 1,
        E: 2,
        '=': 3,
        '!=': 3,
        '<': 4,
        '<=': 4,
        '>': 4,
        '>=': 4,
        '+': 5,
        '-': 5,
        '*': 6,
        '/': 6
    });

    const LANGUAGE_SPEC = Object.freeze({
        dialect: 'Portugol educacional inspirado em Visualg e Portugol Studio',
        version: 'MVP seguro',
        caseSensitive: false,
        sections: [
            'ALGORITMO opcional',
            'DECLARE obrigatorio',
            'INICIO obrigatorio',
            'FIM obrigatorio'
        ],
        grammar: [
            'Declaracoes: a, b: INTEIRO',
            'Vetores: notas: VETOR[5] DE REAL',
            'Atribuicao: x <- 10',
            'Leitura: LEIA x',
            'Saida: ESCREVA "valor", x e ESCREVAL "fim"',
            'Condicional: SE condicao ENTAO ... SENAO ... FIMSE',
            'Laco: ENQUANTO condicao FACA ... FIMENQUANTO',
            'Laco contado: PARA i DE 0 ATE 10 PASSO 1 FACA ... FIMPARA',
            'Escolha: ESCOLHA x / CASO 1: / OUTROCASO: / FIMESCOLHA'
        ],
        mvpLimits: [
            'Sem funcoes e procedimentos nesta versao',
            'Sem matrizes nesta versao',
            'Comentarios apenas com //',
            'Execucao protegida por limite de passos'
        ]
    });

    const REFERENCE_GUIDE = Object.freeze([
        {
            title: 'Declaracao de variaveis',
            syntax: 'nome, outro: INTEIRO',
            example: ['DECLARE', 'idade, total: INTEIRO'].join('\n')
        },
        {
            title: 'Tipos suportados',
            syntax: 'INTEIRO | REAL | CARACTERE | LOGICO',
            example: ['nota: REAL', 'nome: CARACTERE', 'aprovado: LOGICO'].join('\n')
        },
        {
            title: 'Vetores',
            syntax: 'notas: VETOR[3] DE REAL',
            example: ['notas: VETOR[3] DE REAL', 'notas[0] <- 7.5', 'ESCREVAL notas[0]'].join('\n')
        },
        {
            title: 'Atribuicao',
            syntax: 'variavel <- expressao',
            example: ['soma <- 10', 'media <- soma / 2'].join('\n')
        },
        {
            title: 'Leitura',
            syntax: 'LEIA variavel',
            example: ['ESCREVAL "Digite o nome:"', 'LEIA nome'].join('\n')
        },
        {
            title: 'Escrita',
            syntax: 'ESCREVA valor1, valor2',
            example: ['ESCREVA "Total: ", total'].join('\n')
        },
        {
            title: 'Escrita com quebra de linha',
            syntax: 'ESCREVAL valor1, valor2',
            example: ['ESCREVAL "Media final: ", media'].join('\n')
        },
        {
            title: 'Condicional SE',
            syntax: 'SE condicao ENTAO ... SENAO ... FIMSE',
            example: ['SE idade >= 18 ENTAO', '    ESCREVAL "Maior de idade"', 'SENAO', '    ESCREVAL "Menor de idade"', 'FIMSE'].join('\n')
        },
        {
            title: 'Laco ENQUANTO',
            syntax: 'ENQUANTO condicao FACA ... FIMENQUANTO',
            example: ['ENQUANTO contador > 0 FACA', '    ESCREVAL contador', '    contador <- contador - 1', 'FIMENQUANTO'].join('\n')
        },
        {
            title: 'Laco PARA',
            syntax: 'PARA i DE inicio ATE fim PASSO passo FACA ... FIMPARA',
            example: ['PARA i DE 0 ATE 4 PASSO 1 FACA', '    ESCREVAL i', 'FIMPARA'].join('\n')
        },
        {
            title: 'Escolha multipla',
            syntax: 'ESCOLHA expressao / CASO valor: / OUTROCASO: / FIMESCOLHA',
            example: ['ESCOLHA opcao', 'CASO 1:', '    ESCREVAL "Novo cadastro"', 'OUTROCASO:', '    ESCREVAL "Opcao invalida"', 'FIMESCOLHA'].join('\n')
        },
        {
            title: 'Operadores relacionais',
            syntax: '=, !=, <, <=, >, >=',
            example: ['ativo <- idade != 0', 'aprovado <- media >= 7'].join('\n')
        },
        {
            title: 'Operadores logicos',
            syntax: 'E, OU, NAO',
            example: ['liberado <- (idade >= 18) E (idade != 0)', 'negado <- NAO liberado'].join('\n')
        },
        {
            title: 'Execucao passo a passo',
            syntax: 'Use o botao "Passo a passo" e avance com "Proximo passo"',
            example: ['1. Clique em "Passo a passo"', '2. O compilador pausa antes de cada comando', '3. Clique em "Proximo passo" para continuar'].join('\n')
        }
    ]);

    const SAMPLE_PROGRAMS = Object.freeze([
        {
            id: 'basico',
            title: 'Basico',
            description: 'Leitura, tipos e condicional simples.',
            source: [
                'ALGORITMO "BoasVindas"',
                'DECLARE',
                'nome: CARACTERE',
                'idade: INTEIRO',
                'maior: LOGICO',
                'INICIO',
                'ESCREVAL "Qual o seu nome?"',
                'LEIA nome',
                'ESCREVAL "Qual a sua idade?"',
                'LEIA idade',
                'maior <- idade >= 18',
                'SE maior ENTAO',
                '    ESCREVAL "Ola, ", nome',
                '    ESCREVAL "Voce e maior de idade."',
                'SENAO',
                '    ESCREVAL "Ola, ", nome',
                '    ESCREVAL "Voce ainda nao e maior de idade."',
                'FIMSE',
                'FIM'
            ].join('\n')
        },
        {
            id: 'lacos',
            title: 'Lacos',
            description: 'PARA, ENQUANTO e acumulador.',
            source: [
                'ALGORITMO "Lacos"',
                'DECLARE',
                'i, soma: INTEIRO',
                'INICIO',
                'soma <- 0',
                'PARA i DE 1 ATE 5 PASSO 1 FACA',
                '    soma <- soma + i',
                'FIMPARA',
                'ESCREVAL "Soma = ", soma',
                'i <- 3',
                'ENQUANTO i > 0 FACA',
                '    ESCREVAL "Contagem: ", i',
                '    i <- i - 1',
                'FIMENQUANTO',
                'FIM'
            ].join('\n')
        },
        {
            id: 'vetores',
            title: 'Vetores',
            description: 'Declaracao, leitura, escrita e ESCOLHA.',
            source: [
                'ALGORITMO "Notas"',
                'DECLARE',
                'notas: VETOR[3] DE REAL',
                'i: INTEIRO',
                'media: REAL',
                'INICIO',
                'media <- 0',
                'PARA i DE 0 ATE 2 PASSO 1 FACA',
                '    ESCREVAL "Nota ", i, ":"',
                '    LEIA notas[i]',
                '    media <- media + notas[i]',
                'FIMPARA',
                'media <- media / 3',
                'ESCREVAL "Media = ", media',
                'ESCOLHA media >= 7',
                'CASO VERDADEIRO:',
                '    ESCREVAL "Aprovado"',
                'OUTROCASO:',
                '    ESCREVAL "Revisar conteudo"',
                'FIMESCOLHA',
                'FIM'
            ].join('\n')
        }
    ]);

    const SNIPPETS = Object.freeze([
        {
            label: 'SE',
            content: ['SE condicao ENTAO', '    ', 'SENAO', '    ', 'FIMSE'].join('\n')
        },
        {
            label: 'ENQUANTO',
            content: ['ENQUANTO condicao FACA', '    ', 'FIMENQUANTO'].join('\n')
        },
        {
            label: 'PARA',
            content: ['PARA i DE 0 ATE 10 PASSO 1 FACA', '    ', 'FIMPARA'].join('\n')
        },
        {
            label: 'ESCOLHA',
            content: ['ESCOLHA expressao', 'CASO valor:', '    ', 'OUTROCASO:', '    ', 'FIMESCOLHA'].join('\n')
        }
    ]);

    return {
        KEYWORDS,
        BASE_TYPES,
        NUMERIC_TYPES,
        OPERATOR_PRECEDENCE,
        LANGUAGE_SPEC,
        SAMPLE_PROGRAMS,
        SNIPPETS,
        REFERENCE_GUIDE
    };
}));
