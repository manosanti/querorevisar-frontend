/* QueroRevisar — catálogo global de tipos de manutenção.
   Item: [nome, intervalo_km, intervalo_meses, descrição, inspeção_visual?] */
(function () {
  const I = {
    droplet: ["M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"],
    thermo: ["M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"],
    fuel: ["M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18", "M14 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5"],
    belt: ["M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0", "M12 2v3M12 19v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M2 12h3M19 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"],
    filter: ["M22 3H2l8 9.5V19l4 2v-8.5L22 3z"],
    zap: ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"],
    wrench: ["M14.7 6.3a4 4 0 0 1 5.3 5.3l-8.4 8.4a2 2 0 0 1-2.8 0l-2.8-2.8a2 2 0 0 1 0-2.8l8.7-8.1z"],
    disc: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0"],
    activity: ["M22 12h-4l-3 9L9 3l-3 9H2"],
    sliders: ["M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3", "M1 14h6M9 8h6M17 16h6"],
    steering: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", "M12 12v9M12 12 4.6 8.2M12 12l7.4-3.8"],
    chain: ["M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2", "M8 12h8"],
    circle: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0"],
    battery: ["M3 7h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z", "M22 11v2"],
    bulb: ["M9 18h6M10 22h4", "M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z"],
    key: ["M15 2a7 7 0 1 0-6.6 9.3L3 17v4h4l1-2h2v-2h2l1.3-1.3A7 7 0 0 0 15 2z"],
    sensor: ["M8.5 8.5a5 5 0 0 0 0 7M15.5 15.5a5 5 0 0 0 0-7M5.5 5.5a9 9 0 0 0 0 13M18.5 18.5a9 9 0 0 0 0-13", "M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0"],
    snow: ["M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17"],
    flame: ["M12 22c4 0 7-2.7 7-6.5 0-4-3-6-4.5-9.5C13 9 11 9.5 9 12c0-2-1-3.5-1-3.5C6 11 5 13 5 15.5 5 19.3 8 22 12 22z"],
    sparkle: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"],
    box: ["M3 7l9-4 9 4v10l-9 4-9-4V7z", "M3 7l9 4 9-4M12 11v10"],
    shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
    gauge: ["M3.05 13a9 9 0 1 1 17.9 0", "M12 14 18 8"],
    wind: ["M12.8 19.6A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2M9.8 4.4A2 2 0 1 1 11 8H2"]
  };

  const G = [
    ["Motor", "Óleo", I.droplet, [
      ["Óleo do motor", 10000, 12, "Lubrificante principal do motor"],
      ["Filtro de óleo", 10000, 12, "Trocado junto com o óleo"],
      ["Bujão do cárter e arruela", 10000, 12, "Vedação do dreno de óleo"],
      ["Nível de óleo", 1000, 1, "Conferência na vareta", 1],
      ["Vazamentos no cárter", 20000, 12, "Inspeção de manchas sob o motor", 1],
      ["Retentor de válvulas", 100000, 96, "Consumo anormal de óleo"]
    ]],
    ["Motor", "Arrefecimento", I.thermo, [
      ["Fluido de arrefecimento", 40000, 24, "Aditivo do radiador"],
      ["Radiador — limpeza", 30000, 24, "Remoção de sujeira das colmeias"],
      ["Mangueiras do radiador", 60000, 48, "Ressecamento e trincas", 1],
      ["Válvula termostática", 80000, 60, "Controle da temperatura do motor"],
      ["Bomba d'água", 80000, 60, "Circulação do líquido"],
      ["Tampa do reservatório", 60000, 48, "Pressurização do sistema"],
      ["Eletroventilador", 60000, 48, "Ventoinha de resfriamento"]
    ]],
    ["Motor", "Combustível", I.fuel, [
      ["Filtro de combustível", 20000, 24, "Retém impurezas da linha"],
      ["Bomba de combustível", 100000, 84, "Pressão de alimentação"],
      ["Bicos injetores — limpeza", 40000, 36, "Pulverização e consumo"],
      ["Linha e mangueiras de combustível", 60000, 48, "Trincas e vazamentos", 1],
      ["Tampa do tanque", 80000, 60, "Vedação e respiro"],
      ["Regulador de pressão", 100000, 84, "Estabiliza a pressão da linha"],
      ["Canister", 100000, 84, "Recuperação de vapores"]
    ]],
    ["Motor", "Correias", I.belt, [
      ["Correia dentada", 60000, 48, "Sincronismo do motor"],
      ["Tensor da correia dentada", 60000, 48, "Trocado com a correia"],
      ["Correia do alternador", 40000, 36, "Acessórios do motor"],
      ["Rolamentos tensores", 60000, 48, "Ruído e folga"],
      ["Corrente de comando", 120000, 96, "Alongamento e ruído"],
      ["Polia do virabrequim", 100000, 84, "Amortecedor harmônico"]
    ]],
    ["Motor", "Admissão", I.filter, [
      ["Filtro de ar", 15000, 12, "Ar limpo para a combustão"],
      ["Corpo de borboleta — limpeza", 40000, 36, "Marcha lenta instável"],
      ["Coletor de admissão", 100000, 84, "Vedação e carbonização"],
      ["Mangueira de ar", 60000, 48, "Trincas e entradas falsas", 1],
      ["Válvula PCV", 60000, 48, "Ventilação do cárter"]
    ]],
    ["Motor", "Ignição", I.zap, [
      ["Velas de ignição", 20000, 24, "Faísca da combustão"],
      ["Cabos de vela", 40000, 36, "Condução da alta tensão"],
      ["Bobina de ignição", 80000, 60, "Geração da alta tensão"],
      ["Módulo de ignição", 100000, 84, "Comando da centelha"],
      ["Sensor de rotação", 100000, 84, "Referência do virabrequim"],
      ["Ponto de ignição", 40000, 36, "Ajuste de avanço"]
    ]],
    ["Motor", "Geral", I.wrench, [
      ["Revisão geral do motor", 30000, 24, "Checagem completa"],
      ["Junta do cabeçote", 120000, 96, "Vedação entre bloco e cabeçote"],
      ["Coxins do motor", 80000, 60, "Vibração excessiva", 1],
      ["Folga de válvulas", 40000, 36, "Regulagem mecânica"],
      ["Teste de compressão", 60000, 48, "Saúde interna dos cilindros"],
      ["Carter e proteção inferior", 40000, 36, "Fixação e amassados", 1],
      ["Descarbonização", 60000, 48, "Limpeza de câmara"]
    ]],
    ["Freios", "Componentes", I.disc, [
      ["Pastilhas de freio dianteiras", 10000, 12, "Atrito do freio a disco"],
      ["Pastilhas de freio traseiras", 20000, 24, "Atrito do eixo traseiro"],
      ["Discos de freio dianteiros", 40000, 36, "Superfície de frenagem"],
      ["Discos de freio traseiros", 60000, 48, "Superfície de frenagem"],
      ["Lonas / sapatas de freio", 40000, 36, "Freio a tambor"],
      ["Pinças de freio", 60000, 48, "Pistões e guias"],
      ["Freio de estacionamento", 20000, 24, "Curso e regulagem", 1]
    ]],
    ["Freios", "Fluidos", I.droplet, [
      ["Fluido de freio", 20000, 24, "Higroscópico, perde ponto de ebulição"],
      ["Sangria do sistema", 20000, 24, "Remoção de ar das linhas"],
      ["Mangueiras e tubulações", 60000, 48, "Trincas e vazamentos", 1]
    ]],
    ["Freios", "ABS", I.activity, [
      ["Sensores ABS", 60000, 48, "Leitura de rotação das rodas"],
      ["Módulo ABS", 100000, 84, "Diagnóstico eletrônico"],
      ["Anéis fônicos", 80000, 60, "Sujeira e dentes quebrados", 1],
      ["Teste de funcionamento ABS", 20000, 24, "Scanner e pista", 1]
    ]],
    ["Suspensão", "Suspensão", I.sliders, [
      ["Amortecedores dianteiros", 60000, 48, "Controle de oscilação"],
      ["Amortecedores traseiros", 60000, 48, "Controle de oscilação"],
      ["Molas", 100000, 84, "Altura e conforto"],
      ["Batentes e coifas", 40000, 36, "Proteção da haste"],
      ["Bandejas e pivôs", 60000, 48, "Folgas na geometria"],
      ["Buchas da suspensão", 60000, 48, "Ruídos e trepidação"],
      ["Bieletas e barra estabilizadora", 40000, 36, "Estabilidade em curva"],
      ["Rolamentos de roda", 80000, 60, "Zumbido em velocidade"]
    ]],
    ["Direção", "Direção", I.steering, [
      ["Alinhamento e cambagem", 10000, 12, "Desgaste irregular dos pneus"],
      ["Balanceamento", 10000, 12, "Vibração no volante"],
      ["Fluido da direção hidráulica", 40000, 36, "Nível e estado"],
      ["Caixa de direção", 100000, 84, "Folga e vazamento"],
      ["Terminais de direção", 60000, 48, "Folga no esterçamento"],
      ["Coifas da caixa", 60000, 48, "Proteção contra sujeira", 1],
      ["Coluna de direção", 120000, 96, "Ruído e travas"]
    ]],
    ["Transmissão", "Manual", I.chain, [
      ["Óleo do câmbio manual", 60000, 48, "Lubrificação das engrenagens"],
      ["Retentores do câmbio", 100000, 84, "Vazamentos", 1],
      ["Cabo / trambulador", 60000, 48, "Precisão das marchas"],
      ["Rolamentos do câmbio", 120000, 96, "Ruído em neutro"],
      ["Coxim do câmbio", 80000, 60, "Vibração na alavanca"]
    ]],
    ["Transmissão", "Automático", I.chain, [
      ["Óleo do câmbio automático", 60000, 48, "Fluido ATF"],
      ["Filtro do câmbio automático", 60000, 48, "Trocado com o fluido"],
      ["Corpo de válvulas", 120000, 96, "Trancos nas trocas"],
      ["Conversor de torque", 150000, 120, "Patinação e ruído"],
      ["Atualização de software TCU", 60000, 48, "Estratégia de troca"]
    ]],
    ["Transmissão", "Embreagem", I.disc, [
      ["Kit de embreagem", 80000, 60, "Disco, platô e rolamento"],
      ["Fluido de embreagem", 40000, 36, "Acionamento hidráulico"],
      ["Cabo de embreagem", 40000, 36, "Curso do pedal"],
      ["Atuador / cilindro auxiliar", 80000, 60, "Vazamento e curso"],
      ["Volante do motor", 120000, 96, "Bimassa e trepidação"]
    ]],
    ["Transmissão", "Geral", I.wrench, [
      ["Homocinéticas e juntas", 80000, 60, "Estalos em curva"],
      ["Coifas das homocinéticas", 40000, 36, "Perda de graxa", 1],
      ["Semi-eixos", 120000, 96, "Vibração em aceleração"],
      ["Diferencial — óleo", 80000, 60, "Lubrificação do diferencial"]
    ]],
    ["Pneus", "Pneus", I.circle, [
      ["Pneus dianteiros", 40000, 60, "Sulco e envelhecimento"],
      ["Pneus traseiros", 50000, 60, "Sulco e envelhecimento"],
      ["Rodízio de pneus", 10000, 12, "Desgaste uniforme"],
      ["Calibragem", 1000, 1, "Pressão recomendada", 1],
      ["Estepe", 20000, 12, "Pressão e estado", 1],
      ["Válvulas e bicos", 40000, 36, "Vazamento lento"],
      ["Sensores TPMS", 80000, 60, "Bateria do sensor"],
      ["Geometria das rodas", 20000, 24, "Empenos e trincas", 1]
    ]],
    ["Elétrico", "Bateria", I.battery, [
      ["Bateria", 50000, 36, "Partida e carga"],
      ["Terminais e cabos", 20000, 24, "Oxidação", 1],
      ["Teste de carga", 20000, 12, "Tensão em repouso e sob carga", 1],
      ["Alternador", 100000, 84, "Recarga do sistema"],
      ["Correia do alternador — tensão", 40000, 36, "Guinchos ao ligar", 1]
    ]],
    ["Elétrico", "Iluminação", I.bulb, [
      ["Faróis", 40000, 36, "Lâmpadas e alinhamento"],
      ["Lanternas traseiras", 40000, 36, "Posição e freio"],
      ["Luz de freio", 20000, 24, "Todas as três luzes", 1],
      ["Setas e pisca-alerta", 20000, 24, "Frequência e falhas", 1],
      ["Luz de ré", 20000, 24, "Acionamento na marcha à ré", 1],
      ["Iluminação interna", 40000, 36, "Teto e painel", 1],
      ["Polimento dos faróis", 40000, 36, "Amarelamento da lente"]
    ]],
    ["Elétrico", "Partida", I.key, [
      ["Motor de partida", 100000, 84, "Acionamento do arranque"],
      ["Bendix e solenoide", 100000, 84, "Engate na cremalheira"],
      ["Chave de ignição", 120000, 96, "Contato elétrico"],
      ["Relés e fusíveis", 60000, 48, "Oxidação e queima", 1]
    ]],
    ["Elétrico", "Sensores", I.sensor, [
      ["Sonda lambda", 80000, 60, "Mistura ar-combustível"],
      ["Sensor MAP / MAF", 80000, 60, "Massa de ar admitida"],
      ["Sensor de temperatura", 80000, 60, "Leitura do arrefecimento"],
      ["Sensor de detonação", 100000, 84, "Proteção contra pré-ignição"],
      ["Sensores de estacionamento", 60000, 48, "Alcance e ruído", 1],
      ["Câmera de ré", 60000, 48, "Imagem e lente", 1]
    ]],
    ["Ar-Condicionado", "Ar-Condicionado", I.snow, [
      ["Filtro de cabine", 15000, 12, "Ar filtrado no habitáculo"],
      ["Gás refrigerante", 40000, 24, "Carga do sistema"],
      ["Higienização do sistema", 20000, 12, "Odor e fungos"],
      ["Compressor", 100000, 84, "Ruído e acionamento"],
      ["Condensador", 80000, 60, "Sujeira e obstrução", 1],
      ["Válvula de expansão", 100000, 84, "Baixo rendimento"]
    ]],
    ["Escapamento", "Escapamento", I.flame, [
      ["Catalisador", 100000, 84, "Emissões e entupimento"],
      ["Silencioso", 80000, 60, "Ruído e corrosão"],
      ["Coletor de escape", 120000, 96, "Trincas e vazamentos"],
      ["Coxins e abraçadeiras", 40000, 36, "Fixação da linha", 1],
      ["Sonda pós-catalisador", 100000, 84, "Monitor de eficiência"],
      ["Teste de emissões", 30000, 24, "Gases de escapamento"]
    ]],
    ["Carroceria", "Exterior", I.sparkle, [
      ["Palhetas do limpador", 20000, 12, "Visibilidade na chuva"],
      ["Polimento e cristalização", 40000, 24, "Proteção da pintura"],
      ["Retoque anticorrosivo", 60000, 36, "Pontos de ferrugem", 1],
      ["Borrachas de porta", 60000, 48, "Vedação e ruído", 1],
      ["Parabrisa", 100000, 84, "Trincas e riscos", 1],
      ["Retrovisores", 80000, 60, "Regulagem e rebatimento", 1],
      ["Fechaduras e dobradiças", 40000, 36, "Lubrificação"]
    ]],
    ["Carroceria", "Interior", I.box, [
      ["Higienização interna", 20000, 12, "Estofados e carpetes"],
      ["Cintos de segurança", 40000, 36, "Retração e travamento", 1],
      ["Bancos e trilhos", 60000, 48, "Regulagem e folga", 1],
      ["Painel e comandos", 60000, 48, "Botões e luzes", 1],
      ["Vidros elétricos", 60000, 48, "Motor e trilho"],
      ["Tapetes", 40000, 24, "Desgaste e fixação", 1]
    ]],
    ["Fluidos", "Fluidos", I.droplet, [
      ["Água do limpador", 5000, 3, "Reservatório cheio", 1],
      ["Aditivo do radiador — nível", 10000, 6, "Conferência no reservatório", 1],
      ["Fluido de freio — nível", 10000, 6, "Conferência no reservatório", 1],
      ["Óleo da direção — nível", 10000, 6, "Conferência no reservatório", 1],
      ["Graxa de chassi", 40000, 36, "Pontos de articulação"],
      ["Fluido de transmissão — nível", 20000, 12, "Vareta ou bujão", 1]
    ]],
    ["Segurança", "Segurança", I.shield, [
      ["Airbags — diagnóstico", 60000, 48, "Luz de anomalia"],
      ["Extintor", 0, 12, "Validade e carga", 1],
      ["Triângulo e macaco", 0, 12, "Presença e estado", 1],
      ["Chave de roda", 0, 12, "Compatibilidade", 1],
      ["Kit de primeiros socorros", 0, 12, "Validade dos itens", 1],
      ["Vistoria veicular", 0, 12, "Inspeção obrigatória"],
      ["Documentação e licenciamento", 0, 12, "CRLV em dia"]
    ]],
    ["Segurança", "Moto", I.shield, [
      ["Capacete — validade e viseira", 0, 36, "Troca a cada 3 anos ou após queda", 1],
      ["Antena corta-pipa", 0, 12, "Fixação no guidão", 1]
    ]],
    ["Diagnósticos", "Diagnósticos", I.gauge, [
      ["Scanner OBD2", 20000, 12, "Leitura de códigos de falha"],
      ["Teste de bateria e alternador", 20000, 12, "Bancada elétrica"],
      ["Teste de suspensão", 40000, 24, "Banco de provas", 1],
      ["Teste de freios", 20000, 12, "Eficiência e desbalanço"],
      ["Análise de óleo", 40000, 24, "Contaminação e desgaste"],
      ["Revisão pré-viagem", 10000, 6, "Checklist completo", 1]
    ]],
    ["Motor", "Turbo e Sobrealimentação", I.wind, [
      ["Turbina", 120000, 96, "Folga do eixo e ruído"],
      ["Intercooler", 80000, 60, "Obstrução e vazamento"],
      ["Mangueiras pressurizadas", 60000, 48, "Estouros e trincas", 1],
      ["Válvula wastegate", 100000, 84, "Controle de pressão"],
      ["Dutos de ar", 60000, 48, "Fixação e vedação", 1]
    ]],
    ["Moto", "Transmissão final", I.chain, [
      ["Lubrificação da corrente", 500, 1, "Spray compatível com O-ring", 1],
      ["Corrente — limpeza e ajuste", 5000, 6, "Folga e esticadores iguais nos dois lados", 1],
      ["Kit relação (corrente, coroa e pinhão)", 25000, 36, "Troca por desgaste dos dentes"],
      ["Trava da emenda da corrente", 20000, 24, "Elo de fechamento"],
      ["Fixadores da coroa", 10000, 12, "Torque dos parafusos", 1],
      ["Coxins da roda traseira", 10000, 12, "Folga e trepidação na aceleração", 1]
    ]],
    ["Moto", "Suspensão e direção", I.sliders, [
      ["Óleo e retentores do garfo", 30000, 36, "Vazamento nas bengalas"],
      ["Garfo — inspeção de vazamento", 5000, 6, "Retentores e guarda-pó", 1],
      ["Amortecedor traseiro (monoshock)", 40000, 48, "Retorno e vazamento", 1],
      ["Rolamentos da coluna de direção", 10000, 12, "Folga e pontos duros", 1],
      ["Folga do guidão", 5000, 6, "Jogo na direção", 1],
      ["Rolamento da balança", 40000, 0, "Lubrificação do pivô"]
    ]],
    ["Moto", "Comandos e chassi", I.wrench, [
      ["Cabos de acelerador e embreagem", 5000, 6, "Folga de 2 a 3 mm", 1],
      ["Alavancas e pedal do freio", 5000, 6, "Lubrificação dos pivôs"],
      ["Cavalete central e descanso lateral", 20000, 24, "Pivô e mola de retorno"],
      ["Came do freio a tambor", 5000, 6, "Limpeza e lubrificação"],
      ["Aperto geral dos fixadores", 5000, 6, "Eixos, pedaleiras e suportes do motor", 1],
      ["Separador de óleo", 10000, 12, "Limpeza junto da troca de óleo"],
      ["Tubo de respiro do motor", 5000, 6, "Fissuras", 1],
      ["Dreno do silenciador", 5000, 6, "Limpeza do orifício"],
      ["Dreno de água do tanque", 5000, 6, "Água acumulada", 1],
      ["Porta USB", 5000, 6, "Teste de carregamento", 1],
      ["Lavagem técnica", 5000, 6, "Sem jato na parte elétrica"]
    ]]
  ];

  // Aplicabilidade: categorias e itens que não existem em moto (e vice-versa)
  const CAR_CATS = ["Correias", "Turbo e Sobrealimentação", "Suspensão", "Direção", "Manual", "Automático", "Ar-Condicionado", "Exterior", "Interior", "Fluidos"];
  const CAR_ITEMS = ["Freio de estacionamento", "Estepe", "Rodízio de pneus", "Sensores TPMS", "Sensores de estacionamento", "Câmera de ré", "Luz de ré", "Iluminação interna",
    "Cabos de vela", "Correia do alternador — tensão", "Teste de suspensão", "Válvula PCV", "Bendix e solenoide", "Discos de freio traseiros", "Pastilhas de freio traseiras",
    "Homocinéticas e juntas", "Coifas das homocinéticas", "Semi-eixos", "Diferencial — óleo", "Óleo do câmbio automático", "Retentor de válvulas", "Eletroventilador",
    "Tampa do reservatório", "Junta do cabeçote", "Airbags — diagnóstico", "Extintor", "Triângulo e macaco", "Chave de roda", "Kit de primeiros socorros", "Coxins do motor", "Carter e proteção inferior", "Módulo de ignição", "Sensor de detonação", "Canister"];

  let n = 0;
  const cats = G.map(function (row, ci) {
    const catTypes = row[0] === "Moto" || row[1] === "Moto" ? ["moto"] : CAR_CATS.indexOf(row[1]) >= 0 ? ["car"] : ["car", "moto"];
    const items = row[3].map(function (it) {
      n += 1;
      const types = catTypes.length === 1 ? catTypes : CAR_ITEMS.indexOf(it[0]) >= 0 ? ["car"] : catTypes;
      return { id: "m" + n, name: it[0], km: it[1], months: it[2], desc: it[3] || "", insp: !!it[4], cat: ci, types: types };
    });
    return { id: "c" + ci, group: row[0], name: row[1], icon: row[2], items: items, types: catTypes };
  });

  window.QR_CATALOG = { categories: cats, total: n, icons: I };
})();
