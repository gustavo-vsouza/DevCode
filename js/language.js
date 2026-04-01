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
        caseSensitive: false,
        sections: [
            'ALGORITMO e opcional, mas ajuda a dar nome ao projeto.',
            'DECLARE vem antes do codigo executavel.',
            'INICIO abre o bloco principal do programa.',
            'FIM encerra o algoritmo.'
        ],
        grammar: [
            'Variaveis: nome, idade: INTEIRO',
            'Vetores: notas: VETOR[3] DE REAL',
            'Atribuicao: media <- soma / 3',
            'Entrada: LEIA nome',
            'Saida: ESCREVA "Ola, ", nome',
            'Condicoes: SE media >= 7 ENTAO ... FIMSE',
            'Repeticao: ENQUANTO condicao FACA ... FIMENQUANTO',
            'Contagem: PARA i DE 0 ATE 10 PASSO 1 FACA ... FIMPARA',
            'Escolha: ESCOLHA opcao / CASO 1: / OUTROCASO: / FIMESCOLHA'
        ],
        mvpLimits: [
            'Sem funcoes e procedimentos nesta versao.',
            'Sem matrizes nesta versao.',
            'Comentarios em linha com //.',
            'Execucao protegida contra loops muito longos.'
        ]
    });

    const REFERENCE_GUIDE = Object.freeze([
        {
            title: '1. Estrutura basica do programa',
            syntax: 'ALGORITMO / DECLARE / INICIO / FIM',
            summary: 'Todo programa segue uma organizacao simples: primeiro voce declara as variaveis, depois escreve os comandos que serao executados.',
            details: [
                'ALGORITMO e opcional e serve para dar um nome ao projeto.',
                'Tudo o que sera executado precisa ficar entre INICIO e FIM.',
                'Comandos fora da estrutura principal geram erro.'
            ],
            tip: 'Pense nessa estrutura como a capa, a mochila e a caminhada do seu algoritmo.',
            example: [
                'ALGORITMO "Meu Primeiro Programa"',
                'DECLARE',
                '    nome: CARACTERE',
                'INICIO',
                '    ESCREVAL "Ola, mundo!"',
                'FIM'
            ].join('\n'),
            pythonExample: [
                'nome = ""',
                'print("Ola, mundo!")'
            ].join('\n')
        },
        {
            title: '2. Variaveis e tipos de dados',
            syntax: 'idade: INTEIRO | media: REAL | nome: CARACTERE | ativo: LOGICO',
            summary: 'Variaveis guardam valores durante a execucao. Cada uma precisa ser declarada com um tipo adequado.',
            details: [
                'INTEIRO guarda numeros sem casas decimais.',
                'REAL aceita valores com casas decimais.',
                'CARACTERE guarda textos.',
                'LOGICO trabalha com VERDADEIRO e FALSO.'
            ],
            tip: 'Escolher o tipo certo ajuda o compilador a apontar erros antes de executar.',
            example: [
                'DECLARE',
                '    idade: INTEIRO',
                '    media: REAL',
                '    nome: CARACTERE',
                '    aprovado: LOGICO',
                'INICIO',
                '    idade <- 16',
                '    media <- 8.5',
                '    nome <- "Ana"',
                '    aprovado <- VERDADEIRO',
                'FIM'
            ].join('\n'),
            pythonExample: [
                'idade = 16',
                'media = 8.5',
                'nome = "Ana"',
                'aprovado = True'
            ].join('\n')
        },
        {
            title: '3. Vetores',
            syntax: 'notas: VETOR[3] DE REAL',
            summary: 'Vetores servem para guardar varios valores do mesmo tipo usando posicoes numeradas.',
            details: [
                'O primeiro indice sempre e 0.',
                'O ultimo indice depende do tamanho declarado.',
                'Voce pode ler, escrever e usar elementos do vetor em expressoes.'
            ],
            tip: 'Se o vetor tem 3 posicoes, os indices validos sao 0, 1 e 2.',
            example: [
                'DECLARE',
                '    notas: VETOR[3] DE REAL',
                'INICIO',
                '    notas[0] <- 7.5',
                '    notas[1] <- 8.0',
                '    notas[2] <- 9.0',
                '    ESCREVAL "Primeira nota: ", notas[0]',
                'FIM'
            ].join('\n'),
            pythonExample: [
                'notas = [0.0, 0.0, 0.0]',
                'notas[0] = 7.5',
                'notas[1] = 8.0',
                'notas[2] = 9.0',
                'print("Primeira nota:", notas[0])'
            ].join('\n')
        },
        {
            title: '4. Entrada e saida de dados',
            syntax: 'LEIA variavel | ESCREVA valor1, valor2 | ESCREVAL valor1, valor2',
            summary: 'Com LEIA o programa espera uma resposta do usuario. Com ESCREVA e ESCREVAL voce mostra mensagens e valores no terminal.',
            details: [
                'ESCREVA continua na mesma linha.',
                'ESCREVAL escreve e pula para a linha seguinte.',
                'Voce pode juntar texto, numeros, variaveis e expressoes usando virgula.'
            ],
            tip: 'Uma boa mensagem antes do LEIA deixa o programa mais acolhedor para quem esta usando.',
            example: [
                'DECLARE',
                '    nome: CARACTERE',
                'INICIO',
                '    ESCREVA "Digite seu nome: "',
                '    LEIA nome',
                '    ESCREVAL "Bem-vindo, ", nome',
                'FIM'
            ].join('\n'),
            pythonExample: [
                'nome = input("Digite seu nome: ")',
                'print("Bem-vindo,", nome)'
            ].join('\n')
        },
        {
            title: '5. Operadores e expressoes',
            syntax: '+, -, *, /, =, !=, <, <=, >, >=, E, OU, NAO',
            summary: 'Expressoes combinam valores para gerar resultados numericos ou logicos. A linguagem respeita parenteses e precedencia de operadores.',
            details: [
                'Use parenteses quando quiser deixar a conta ou a condicao mais clara.',
                'O operador de diferente oficial desta IDE e !=.',
                'Operadores logicos ajudam a montar testes mais completos.'
            ],
            tip: 'Quando uma expressao parece grande, quebrar com parenteses costuma deixar tudo mais legivel.',
            example: [
                'DECLARE',
                '    a, b: INTEIRO',
                '    resultado: LOGICO',
                'INICIO',
                '    a <- 10',
                '    b <- 4',
                '    resultado <- (a > b) E (a != 0)',
                '    ESCREVAL resultado',
                'FIM'
            ].join('\n'),
            pythonExample: [
                'a = 10',
                'b = 4',
                'resultado = (a > b) and (a != 0)',
                'print(resultado)'
            ].join('\n')
        },
        {
            title: '6. Condicionais com SE e SENAO',
            syntax: 'SE condicao ENTAO ... SENAO ... FIMSE',
            summary: 'O comando SE decide qual bloco executar com base em uma condicao logica.',
            details: [
                'Se a condicao for VERDADEIRO, o bloco do SE sera executado.',
                'Se houver SENAO, ele sera usado quando a condicao for FALSO.',
                'Voce pode aninhar um SE dentro do outro.'
            ],
            tip: 'Leia sua condicao em voz alta. Se ela fizer sentido como frase, geralmente o codigo tambem fica claro.',
            example: [
                'DECLARE',
                '    media: REAL',
                'INICIO',
                '    media <- 6.8',
                '    SE media >= 7 ENTAO',
                '        ESCREVAL "Aprovado"',
                '    SENAO',
                '        ESCREVAL "Precisa estudar mais"',
                '    FIMSE',
                'FIM'
            ].join('\n'),
            pythonExample: [
                'media = 6.8',
                'if media >= 7:',
                '    print("Aprovado")',
                'else:',
                '    print("Precisa estudar mais")'
            ].join('\n')
        },
        {
            title: '7. Repeticao com ENQUANTO',
            syntax: 'ENQUANTO condicao FACA ... FIMENQUANTO',
            summary: 'ENQUANTO repete um bloco enquanto a condicao continuar verdadeira.',
            details: [
                'A condicao e testada antes de cada repeticao.',
                'Se ela comecar falsa, o bloco nao executa nenhuma vez.',
                'Voce precisa alterar alguma variavel dentro do laco para evitar repeticao infinita.'
            ],
            tip: 'Se o laco nao termina, confira se a variavel de controle esta sendo atualizada.',
            example: [
                'DECLARE',
                '    contador: INTEIRO',
                'INICIO',
                '    contador <- 3',
                '    ENQUANTO contador > 0 FACA',
                '        ESCREVAL "Contagem: ", contador',
                '        contador <- contador - 1',
                '    FIMENQUANTO',
                'FIM'
            ].join('\n'),
            pythonExample: [
                'contador = 3',
                'while contador > 0:',
                '    print("Contagem:", contador)',
                '    contador -= 1'
            ].join('\n')
        },
        {
            title: '8. Repeticao com PARA',
            syntax: 'PARA i DE inicio ATE fim PASSO passo FACA ... FIMPARA',
            summary: 'PARA e ideal quando voce ja sabe quantas vezes o bloco precisa repetir.',
            details: [
                'A variavel de controle precisa ser INTEIRO.',
                'PASSO e opcional; quando omitido, o valor padrao e 1.',
                'Voce pode usar passo negativo para contagem regressiva.'
            ],
            tip: 'PARA combina muito bem com vetores, porque os indices normalmente crescem de 0 ate o ultimo elemento.',
            example: [
                'DECLARE',
                '    i: INTEIRO',
                'INICIO',
                '    PARA i DE 0 ATE 4 PASSO 1 FACA',
                '        ESCREVAL "Indice: ", i',
                '    FIMPARA',
                'FIM'
            ].join('\n'),
            pythonExample: [
                'for i in range(0, 5, 1):',
                '    print("Indice:", i)'
            ].join('\n')
        },
        {
            title: '9. ESCOLHA, CASO e OUTROCASO',
            syntax: 'ESCOLHA expressao / CASO valor: / OUTROCASO: / FIMESCOLHA',
            summary: 'ESCOLHA e uma forma elegante de testar varios caminhos para o mesmo valor.',
            details: [
                'Cada CASO compara a expressao principal com um valor.',
                'OUTROCASO funciona como uma alternativa padrao.',
                'Esse formato costuma ficar mais organizado do que muitos SE seguidos.'
            ],
            tip: 'Use ESCOLHA quando a mesma variavel ou expressao precisa ser comparada com muitos valores exatos.',
            example: [
                'DECLARE',
                '    opcao: INTEIRO',
                'INICIO',
                '    opcao <- 2',
                '    ESCOLHA opcao',
                '    CASO 1:',
                '        ESCREVAL "Novo jogo"',
                '    CASO 2:',
                '        ESCREVAL "Continuar"',
                '    OUTROCASO:',
                '        ESCREVAL "Opcao invalida"',
                '    FIMESCOLHA',
                'FIM'
            ].join('\n'),
            pythonExample: [
                'opcao = 2',
                'match opcao:',
                '    case 1:',
                '        print("Novo jogo")',
                '    case 2:',
                '        print("Continuar")',
                '    case _:',
                '        print("Opcao invalida")'
            ].join('\n')
        },
        {
            title: '10. Passo a passo e recursos do editor',
            syntax: 'Passo a passo | formatacao | busca',
            summary: 'A IDE foi pensada para aprender testando. Voce pode executar normalmente ou acompanhar o programa comando por comando.',
            details: [
                'Passo a passo pausa antes de cada instrucao executada.',
                'Formatar organiza o codigo e a busca ajuda a encontrar trechos importantes.'
            ],
            tip: 'Se quiser entender um laco ou uma condicao, execute em passo a passo e observe o fluxo.',
            example: [
                '1. Escreva seu codigo no editor.',
                '2. Clique em "Passo a passo".',
                '3. Use "Proximo passo" para acompanhar a execucao.',
                '4. Observe o terminal e o codigo destacado.'
            ].join('\n'),
            pythonExample: [
                '# Em Python, o equivalente costuma ser',
                '# usar o depurador da IDE ou prints temporarios',
                'contador = 3',
                'while contador > 0:',
                '    print("valor atual:", contador)',
                '    contador -= 1'
            ].join('\n')
        },
        {
            title: '11. O que esta disponivel nesta versao',
            syntax: 'Recursos suportados agora',
            summary: 'Esta versao foi focada no que mais ajuda no aprendizado inicial e intermediario.',
            details: [
                'Variaveis simples e vetores.',
                'ESCREVA, ESCREVAL e LEIA.',
                'SE, SENAO, ENQUANTO, PARA, ESCOLHA, CASO e OUTROCASO.',
                'Analise de erros com linha destacada e validacao semantica basica.'
            ],
            tip: 'Funcoes, procedimentos e matrizes ainda nao entraram para manter a experiencia mais clara nesta fase.',
            example: [
                'Comece com um programa pequeno, como uma calculadora simples,',
                'um cadastro de aluno ou uma media com vetor de notas.'
            ].join('\n'),
            pythonExample: [
                '# Em Python voce tambem encontra os mesmos blocos basicos:',
                '# variaveis, listas, if, while, for e match',
                'print("As ideias sao parecidas, muda a sintaxe.")'
            ].join('\n')
        }
    ]);

    const SAMPLE_PROGRAMS = Object.freeze([
        {
            id: 'boletim',
            title: 'Boletim do Aluno',
            description: 'Le nome, notas, calcula media e mostra o resultado final.',
            featured: true,
            source: [
                'ALGORITMO "Boletim"',
                'DECLARE',
                'nome: CARACTERE',
                'notas: VETOR[3] DE REAL',
                'i: INTEIRO',
                'media: REAL',
                'INICIO',
                'ESCREVA "Digite seu nome: "',
                'LEIA nome',
                'media <- 0',
                'PARA i DE 0 ATE 2 PASSO 1 FACA',
                '    ESCREVA "Digite a nota ", i + 1, ": "',
                '    LEIA notas[i]',
                '    media <- media + notas[i]',
                'FIMPARA',
                'media <- media / 3',
                'ESCREVAL "Media do aluno ", nome, ": ", media',
                'SE media >= 7 ENTAO',
                '    ESCREVAL "Status: APROVADO!"',
                'SENAO',
                '    ESCREVAL "Status: REPROVADO."',
                'FIMSE',
                'FIM'
            ].join('\n')
        },
        {
            id: 'menu',
            title: 'Menu com ESCOLHA',
            description: 'Mostra como usar ESCOLHA, CASO e OUTROCASO.',
            source: [
                'ALGORITMO "Menu"',
                'DECLARE',
                'opcao: INTEIRO',
                'INICIO',
                'ESCREVA "Digite 1 para iniciar ou 2 para sair: "',
                'LEIA opcao',
                'ESCOLHA opcao',
                'CASO 1:',
                '    ESCREVAL "Iniciando..."',
                'CASO 2:',
                '    ESCREVAL "Encerrando..."',
                'OUTROCASO:',
                '    ESCREVAL "Opcao invalida"',
                'FIMESCOLHA',
                'FIM'
            ].join('\n')
        },
        {
            id: 'contagem',
            title: 'Contagem Regressiva',
            description: 'Combina ENQUANTO e PARA em um exemplo curto.',
            source: [
                'ALGORITMO "Contagem"',
                'DECLARE',
                'contador: INTEIRO',
                'INICIO',
                'contador <- 3',
                'ENQUANTO contador > 0 FACA',
                '    ESCREVAL "Enquanto: ", contador',
                '    contador <- contador - 1',
                'FIMENQUANTO',
                'PARA contador DE 10 ATE 0 PASSO -2 FACA',
                '    ESCREVAL "Contagem regressiva: ", contador',
                'FIMPARA',
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
