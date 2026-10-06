/* QueroRevisar — planos de manutenção do fabricante, por modelo.
   Fonte: manual do proprietário. Regra: [ações, inícioKm, intervaloKm, intervaloMeses, seNecessário]
   Gatilho: o que vier primeiro entre km e meses. Equivalência oficial: 5.000 km = 6 meses. */
(function () {
  const PRI = ["trocar", "ajustar", "apertar", "limpar", "lubrificar", "completar", "verificar"];
  const SIS = {
    geral: ["Geral", "sparkle"], motor: ["Motor", "droplet"], combustivel: ["Combustível", "fuel"],
    escapamento: ["Escapamento", "flame"], eletrica: ["Elétrica", "zap"], transmissao: ["Transmissão", "chain"],
    chassi: ["Chassi", "wrench"], direcao: ["Direção", "steering"], suspensao: ["Suspensão", "sliders"],
    freios: ["Freios", "disc"], comandos: ["Comandos", "sliders"], pneus: ["Pneus", "circle"]
  };
  // [id, nº, sistema, nome, tipo, regras, especificação, observação, extras]
  const N150 = [
    ["lavagem", 1, "geral", "Manutenção / lavagem", "inspecao", [["limpar", 5000, 5000, 6]], "", "Evitar água no tanque, silenciador e peças elétricas. Detergente sem soda cáustica. Não incluso no preço da revisão."],
    ["oleo-motor", 2, "motor", "Óleo do motor", "intervalo", [["trocar", 10000, 10000, 12], ["verificar,completar", 5000, 5000, 6]], "SAE 10W40 JASO MA2 API SN, 1.150 ml", "Limpar a janela de nível a cada 10.000 km. Não reutilizar óleo drenado."],
    ["filtro-oleo", 3, "motor", "Filtro de óleo do motor", "intervalo", [["trocar", 10000, 10000, 12]]],
    ["separador-oleo", 4, "motor", "Separador de óleo", "inspecao", [["limpar", 10000, 10000, 12]], "", "Limpar no momento da troca de óleo."],
    ["filtro-ar", 5, "motor", "Filtro de ar, O-ring da tampa e duto de drenagem", "intervalo", [["trocar,limpar", 20000, 20000, 24]], "Filtro viscoso (não lavar)", "Trocar o O-ring junto. Em ambiente poeirento, limpar com mais frequência."],
    ["dutos-combustivel", 6, "combustivel", "Dutos de combustível (fissuras)", "intervalo", [["trocar", 15000, 15000, 18], ["verificar,trocar", 5000, 5000, 6, 1]]],
    ["mangueiras-bomba", 7, "combustivel", "Mangueiras de nylon da bomba de combustível", "desgaste", [["verificar,trocar", 20000, 20000, 24, 1]], "Conector rápido"],
    ["vela", 8, "motor", "Vela de ignição", "intervalo", [["trocar", 30000, 30000, 36], ["limpar,ajustar", 10000, 10000, 12]], "Champion, folga 0,8 a 0,9 mm", "Trocar antes se a inspeção indicar."],
    ["folga-valvulas", 9, "motor", "Folga das válvulas", "inspecao", [["verificar,ajustar", 10000, 10000, 12]]],
    ["respiro-motor", 10, "motor", "Tubo de respiro do motor (fissuras)", "desgaste", [["verificar,trocar", 10000, 5000, 6, 1]]],
    ["mangueiras-evap", 11, "combustivel", "Mangueiras do sistema EVAP (fissuras)", "desgaste", [["verificar,trocar", 5000, 5000, 6, 1]]],
    ["dreno-silenciador", 12, "escapamento", "Orifício de dreno do silenciador", "inspecao", [["limpar", 10000, 5000, 6]]],
    ["chicote", 13, "eletrica", "Chicote, conduítes, mangas de PVC e abraçadeiras", "inspecao", [["verificar,ajustar,apertar", 5000, 5000, 6]], "", "Fita elétrica em conduítes danificados."],
    ["bateria", 14, "eletrica", "Bateria: conexões, teste de carga e tampa do positivo", "desgaste", [["verificar,ajustar,lubrificar,apertar", 5000, 5000, 6]], "12V 8Ah VRLA", "Troca conforme o teste de carga.", { produtos: ["vaselina nos terminais", "testador Midtronics"] }],
    ["chave-ignicao", 15, "eletrica", "Contatos da chave de ignição", "inspecao", [["limpar,lubrificar", 10000, 5000, 6]], "", "", { produtos: ["spray WD40"] }],
    ["bobina", 16, "eletrica", "Conexões da bobina HT", "inspecao", [["verificar,apertar", 5000, 5000, 6]]],
    ["motor-partida", 17, "eletrica", "Conexões do motor e do relé de partida", "inspecao", [["verificar,apertar", 5000, 5000, 6]]],
    ["diagnostico-ecu", 18, "eletrica", "Códigos de falha e software da ECU", "inspecao", [["verificar", 5000, 5000, 6]], "", "Ler, limpar histórico e atualizar se aplicável."],
    ["corrente", 19, "transmissao", "Corrente O-ring: desgaste, limpeza, lubrificação e ajuste", "desgaste", [["verificar,limpar,lubrificar,ajustar,trocar", 5000, 5000, 6, 1]], "Folga 20 a 30 mm; eixo traseiro a 10 kgf·m após ajuste", "Troca só por desgaste.", { produtos: ["diesel + SAE 90 (50:50) para limpeza", "SAE 90 para lubrificar"] }],
    ["trava-corrente", 20, "transmissao", "Trava da emenda (elo) da corrente", "intervalo", [["trocar", 20000, 20000, 24]]],
    ["cavaletes", 21, "chassi", "Pivô do cavalete central e do descanso lateral", "inspecao", [["limpar,lubrificar", 20000, 20000, 24]], "", "", { produtos: ["graxa AP"] }],
    ["folga-guidao", 22, "direcao", "Folga no guidão", "inspecao", [["verificar,ajustar", 5000, 5000, 6]]],
    ["rolamentos-direcao", 23, "direcao", "Rolamentos da coluna de direção", "desgaste", [["verificar,limpar,lubrificar,trocar", 10000, 10000, 12, 1]], "", "", { produtos: ["graxa Limaplex HTX3"] }],
    ["garfo", 24, "suspensao", "Óleo, retentores e guarda-pó do garfo", "intervalo", [["trocar", 30000, 30000, 36], ["verificar,trocar", 5000, 5000, 6, 1]], "", "Óleo + retentor de óleo + retentor de poeira, sempre em pares."],
    ["rolamento-balanca", 25, "suspensao", "Rolamento NRB da balança", "inspecao", [["lubrificar", 40000, 40000, 0]], "", "Manual não informa equivalente em meses.", { produtos: ["graxa AP"] }],
    ["pastilhas-sapatas", 26, "freios", "Pastilha (dianteiro) e sapata (traseiro)", "desgaste", [["trocar", 15000, 15000, 18], ["verificar,trocar", 5000, 5000, 6, 1]], "", "Fabricante manda trocar a cada 15.000 km; na prática depende do uso."],
    ["came-tambor", 27, "freios", "Came do freio a tambor", "inspecao", [["limpar,lubrificar", 5000, 5000, 6]], "", "", { produtos: ["graxa AP"] }],
    ["freio-hidraulico", 28, "freios", "Freio hidráulico: vazamentos, mangueiras e fluido DOT 4", "intervalo", [["trocar", 30000, 30000, 36], ["verificar,ajustar,completar,trocar", 5000, 5000, 6, 1]], "DOT 4 de recipiente vedado", "Troca inclui vedações do cilindro mestre e da pinça. Nível abaixo do MIN: não rodar até resolver.", { subitens: ["Origem de vazamentos", "Mangueiras dianteira e traseira", "Nível do fluido"] }],
    ["fixadores-coroa", 29, "transmissao", "Fixadores da coroa", "inspecao", [["verificar,apertar", 10000, 10000, 12]], "Torque 3,2 a 3,8 kgf·m"],
    ["coxins-roda", 30, "transmissao", "Coxins de borracha da roda traseira", "desgaste", [["verificar,trocar", 10000, 10000, 12, 1]]],
    ["cabos", 31, "comandos", "Folga de todos os cabos", "desgaste", [["verificar,ajustar,trocar", 5000, 5000, 6, 1]], "Acelerador 2 a 3 mm; embreagem 2 a 3 mm", "Trocar se a operação estiver difícil."],
    ["foco-farol", 32, "eletrica", "Foco do farol", "inspecao", [["verificar,ajustar", 5000, 5000, 6]]],
    ["luzes-buzina", 33, "eletrica", "Luzes, LEDs, interruptores e buzina", "inspecao", [["verificar,ajustar", 5000, 5000, 6]]],
    ["alavancas", 34, "comandos", "Alavanca da embreagem e pedal do freio traseiro", "inspecao", [["verificar,lubrificar", 5000, 5000, 6]], "", "", { produtos: ["graxa AP"] }],
    ["pressao-pneus", 35, "pneus", "Pressão dos pneus", "inspecao", [["verificar,ajustar", 5000, 5000, 6]], "Dianteiro 25 psi · traseiro 28 psi (32 com garupa)"],
    ["retrovisores", 36, "chassi", "Retrovisores: posição e articulação", "inspecao", [["verificar,ajustar", 5000, 5000, 6]]],
    ["fixadores-gerais", 37, "chassi", "Aperto de todos os fixadores", "inspecao", [["verificar,apertar", 5000, 5000, 6]], "", "", { subitens: ["Eixo dianteiro 5 a 6 kgf·m", "Eixo traseiro 8 a 10 kgf·m", "Eixo da balança 12 a 14 kgf·m", "Pedaleiras 1,8 a 2,2 kgf·m", "Suporte superior do motor 2,2 a 2,4 kgf·m", "Suportes do motor 4 a 4,2 kgf·m"] }],
    ["porta-usb", 38, "eletrica", "Porta USB", "desgaste", [["verificar,trocar", 5000, 5000, 6, 1]], "", "Testar com o motor ligado."],
    ["dreno-partida", 39, "eletrica", "Dreno abaixo do motor de partida", "inspecao", [["verificar,limpar", 5000, 5000, 6]]],
    ["dreno-tanque", 40, "combustivel", "Dreno de água do tanque", "inspecao", [["verificar,limpar", 5000, 5000, 6]]]
  ];

  const ACT = { trocar: "trocar", ajustar: "ajustar", apertar: "apertar", limpar: "limpar", lubrificar: "lubrificar", completar: "completar", verificar: "verificar" };
  function fk(n) { return n.toLocaleString("pt-BR"); }
  function ruleLine(r) {
    const ac = r.acoes.filter(a => !(r.seNecessario && a === "trocar"));
    const txt = ac.map(a => ACT[a]).join(", ");
    const head = txt.charAt(0).toUpperCase() + txt.slice(1);
    return head + " a cada " + fk(r.intervaloKm) + " km" + (r.intervaloMeses ? " ou " + r.intervaloMeses + " meses" : "") + (r.seNecessario ? " · troca se necessário" : "");
  }

  function build(id, meta, rows) {
    const bySis = {};
    rows.forEach(function (row) {
      const rules = row[5].map(function (r) {
        const acoes = r[0].split(",");
        const acoesOrd = acoes.slice().sort(function (a, b) { return PRI.indexOf(a) - PRI.indexOf(b); });
        return { acoes: acoes, primary: acoesOrd[0], inicioKm: r[1], intervaloKm: r[2], intervaloMeses: r[3] || 0, inicioMeses: Math.round((r[1] / 5000) * 6), seNecessario: !!r[4] };
      });
      const main = rules[0];
      const ex = row[8] || {};
      const it = {
        id: id + ":" + row[0], name: row[3], num: row[1], tipo: row[4],
        km: main.intervaloKm, months: main.intervaloMeses, insp: row[4] === "inspecao",
        desc: row[6] || row[7] || "", spec: row[6] || "", obs: row[7] || "",
        produtos: ex.produtos || [], subitens: ex.subitens || [],
        rules: rules, rulesLine: rules.map(ruleLine).join(" · ")
      };
      (bySis[row[2]] = bySis[row[2]] || []).push(it);
    });
    const cats = Object.keys(bySis).map(function (k) {
      return { id: id + "-" + k, group: meta.brand + " " + meta.model, name: SIS[k][0], iconKey: SIS[k][1], items: bySis[k], plan: id };
    });
    return Object.assign({ id: id, categories: cats, total: rows.length, pri: PRI }, meta);
  }

  const plans = {};
  plans["bajaj-pulsar-n150"] = build("bajaj-pulsar-n150", {
    brand: "Bajaj", model: "Pulsar N150", type: "moto",
    source: "Manual do proprietário Bajaj Pulsar N150 · tabela de manutenção p. 62-66",
    tags: ["corrente-oring", "refrigeracao-ar", "injecao", "freio-disco-dianteiro", "freio-tambor-traseiro", "abs-dianteiro", "pneu-sem-camara", "porta-usb"],
    specs: [["Óleo", "10W40 JASO MA2 · 1.150 ml"], ["Vela", "Champion · folga 0,8–0,9 mm"], ["Pneus", "90/90-17 · 120/80-17 sem câmara"], ["Pressão", "25 psi diant. · 28 psi tras."], ["Corrente", "folga 20–30 mm"], ["Bateria", "12V 8Ah VRLA"], ["Freio", "disco Ø260 ABS · tambor Ø130"], ["Fluido", "DOT 4"]],
    // [km, meses, peças, mão de obra, total, itens verificados]
    milestones: [[1000, 1, 161.73, 0, 161.73, 18], [5000, 6, 161.73, 145, 306.73, 23], [10000, 12, 161.73, 217.5, 379.23, 32], [15000, 18, 280.51, 290, 570.51, 26], [20000, 24, 236.37, 217.5, 453.87, 36], [25000, 30, 161.73, 217.5, 379.23, 26], [30000, 36, 381.74, 217.5, 599.24, 32]],
    pricesValid: "2026-09-30", network: "concessionárias Bajaj",
    breakIn: { name: "Revisão de amaciamento", kmMin: 900, kmMax: 1000, months: 1, freeLabor: true },
    ownerCare: [
      ["Lubrificar a corrente com spray", "a cada 500 km", "Spray a 5–10 cm por trás da coroa, girando a roda ao contrário."],
      ["Nível de óleo pela janela", "diário", "Moto em pé, perpendicular ao solo, em piso plano."],
      ["Checklist antes de pilotar", "diário", "Combustível (mín. 3 L), óleo, freio acima do MIN, corrente, luzes, pneus, retrovisores."],
      ["Desconectar a bateria", "parada > 2 semanas", "Soltar os cabos + e −."]
    ],
    conditional: [
      ["Óleo fora da especificação Bajaj", "Troca passa a cada 5.000 km ou 6 meses e completar a cada 2.500 km."],
      ["Uso em ambiente com muita poeira", "Filtro de ar pede limpeza mais frequente."],
      ["Uso severo", "O plano padrão não vale; seguir o plano próprio do manual."]
    ],
    notes: [
      "Especificações dizem 1 vela, página da vela diz 2. Motor é monocilíndrico: 1 vela.",
      "Torque do eixo traseiro: tabela 8–10 kgf·m, página da corrente 10 kgf·m após ajuste.",
      "Rolamento da balança (40.000 km) não tem equivalente em meses."
    ]
  }, N150);

  window.QR_PLANS = {
    list: plans,
    find: function (brand, model) {
      const k = Object.keys(plans).find(function (id) { return plans[id].brand === brand && plans[id].model === model; });
      return k ? plans[k] : null;
    }
  };
})();
