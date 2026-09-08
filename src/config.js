// Narco Atlas — display configuration shared by the app and the build.
// Organization identity (name, short label, lineage family, color) lives here so the
// research data can stay free of presentation concerns.
window.PLAZA_CONFIG = (function () {
  const ORGS = [
    // id, name, short, family, color, [light-theme color]
    ['guadalajara', 'Guadalajara Cartel', 'Guadalajara', 'guadalajara', '#C89B2E', '#9E7716'],
    ['sonora', 'Sonora Cartel (Caro Quintero clan)', 'Sonora', 'guadalajara', '#B9A26B', '#8C7640'],
    ['colima', 'Colima Cartel (Amezcua brothers)', 'Colima', 'independent', '#9CCFA4', '#3D8A4B'],
    ['oaxaca', 'Díaz Parada organization', 'Oaxaca', 'independent', '#A7935A', '#7A6836'],

    ['sinaloa', 'Sinaloa Cartel', 'Sinaloa', 'sinaloa', '#4A8FD1', '#2B6CB0'],
    ['chapitos', 'Los Chapitos', 'Chapitos', 'sinaloa', '#8FC3F2', '#3F86D6'],
    ['mayiza', 'La Mayiza', 'Mayiza', 'sinaloa', '#2A5B8F', '#1F4A78'],
    ['caborca', 'Caborca Cartel', 'Caborca', 'guadalajara', '#E0C46A', '#A88F2A'],

    ['beltran_leyva', 'Beltrán Leyva Organization', 'Beltrán Leyva', 'beltran', '#9A63D6', '#6E3DB3'],
    ['pacifico_sur', 'Cártel del Pacífico Sur', 'Pacífico Sur', 'beltran', '#6D4A9E', '#5A3C86'],
    ['cida', 'Cártel Independiente de Acapulco', 'CIDA', 'beltran', '#B58BE6', '#7B4FC2'],
    ['guerreros_unidos', 'Guerreros Unidos', 'Guerreros Unidos', 'beltran', '#C39BEA', '#8A5CC9'],
    ['rojos', 'Los Rojos', 'Rojos', 'beltran', '#7A47B3', '#5E3396'],

    ['tijuana', 'Tijuana Cartel (Arellano Félix)', 'Tijuana', 'guadalajara', '#22C4BC', '#0F8C86'],
    ['juarez', 'Juárez Cartel (Carrillo Fuentes)', 'Juárez', 'guadalajara', '#D257A6', '#A8327E'],

    ['gulf', 'Gulf Cartel', 'Gulf', 'gulf', '#2AA37A', '#187A57'],
    ['zetas', 'Los Zetas', 'Zetas', 'gulf', '#8A9BB0', '#5B6B80'],
    ['cdn', 'Cártel del Noreste', 'Noreste', 'gulf', '#9ED45A', '#5F9420'],
    ['zetas_vieja_escuela', 'Zetas Vieja Escuela', 'Zetas V.E.', 'gulf', '#6E6A2A', '#57531C'],
    ['talibanes', 'Los Talibanes', 'Talibanes', 'gulf', '#B8B36A', '#7E7A3A'],

    ['milenio', 'Milenio Cartel (Valencia)', 'Milenio', 'cjng', '#E58A8A', '#C24E4E'],
    ['cjng', 'Cártel Jalisco Nueva Generación', 'CJNG', 'cjng', '#DE3B3B', '#BE2727'],
    ['mezcales', 'Los Mezcales', 'Mezcales', 'cjng', '#A62A2A', '#8C1F1F'],
    ['chiapas_guatemala', 'Cártel de Chiapas y Guatemala', 'Chiapas y Guatemala', 'cjng', '#EE6A5F', '#C94236'],
    ['barredora', 'La Barredora', 'Barredora', 'cjng', '#C74B62', '#A33049'],

    ['familia_michoacana', 'La Familia Michoacana', 'La Familia', 'michoacan', '#F08A2C', '#C96A14'],
    ['templarios', 'Knights Templar', 'Templarios', 'michoacan', '#BF5A23', '#9C4516'],
    ['nueva_familia_michoacana', 'La Nueva Familia Michoacana', 'Nueva Familia', 'michoacan', '#F3B25C', '#C98A2C'],

    ['santa_rosa_lima', 'Santa Rosa de Lima Cartel', 'Santa Rosa', 'independent', '#F2E38A', '#A89420'],
    ['carteles_unidos', 'Cárteles Unidos', 'Cárteles Unidos', 'independent', '#B07A4A', '#875A2E'],

    ['ardillos', 'Los Ardillos', 'Ardillos', 'guerrero', '#8E9F7A', '#657650'],
    ['tlacos', 'Los Tlacos', 'Tlacos', 'guerrero', '#6F8A62', '#4E6842'],

    ['union_tepito', 'La Unión Tepito', 'Unión Tepito', 'cdmx', '#B3A79A', '#7A6E60'],
    ['anti_union', 'Fuerza Anti-Unión', 'Anti-Unión', 'cdmx', '#8C8176', '#655B50'],
    ['tlahuac', 'Cártel de Tláhuac', 'Tláhuac', 'cdmx', '#CFC3B4', '#8F8474'],

    ['autodefensas', 'Autodefensas (self-defense militias)', 'Autodefensas', 'state', '#E6DECF', '#8A8070'],
    ['government', 'Mexican state forces', 'Government', 'state', '#6F7680', '#4E555E'],
    ['us_government', 'United States government', 'US', 'state', '#7C8A9E', '#4F5E73'],
    ['other', 'Other local groups', 'Other', 'state', '#8B8378', '#6B655B'],
    ['fragmented', 'Fragmented — many small groups', 'Fragmented', 'none', '#5B554D', '#8F877B'],
    ['none', 'No dominant organization', 'None', 'none', '#2A2723', '#D8D3CA'],
  ];

  const ORG_META = {};
  const ORG_ORDER = [];
  ORGS.forEach(([id, name, short, family, color, colorLight]) => {
    ORG_META[id] = { id, name, short, family, color, colorLight };
    ORG_ORDER.push(id);
  });

  const STATES = {
    AGU: 'Aguascalientes', BCN: 'Baja California', BCS: 'Baja California Sur', CAM: 'Campeche',
    CHP: 'Chiapas', CHH: 'Chihuahua', CMX: 'Ciudad de México', COA: 'Coahuila', COL: 'Colima',
    DUR: 'Durango', GUA: 'Guanajuato', GRO: 'Guerrero', HID: 'Hidalgo', JAL: 'Jalisco',
    MEX: 'Estado de México', MIC: 'Michoacán', MOR: 'Morelos', NAY: 'Nayarit', NLE: 'Nuevo León',
    OAX: 'Oaxaca', PUE: 'Puebla', QUE: 'Querétaro', ROO: 'Quintana Roo', SLP: 'San Luis Potosí',
    SIN: 'Sinaloa', SON: 'Sonora', TAB: 'Tabasco', TAM: 'Tamaulipas', TLA: 'Tlaxcala',
    VER: 'Veracruz', YUC: 'Yucatán', ZAC: 'Zacatecas',
  };
  // States too small to carry a label at the default zoom.
  const SMALL_STATES = new Set(['CMX', 'TLA', 'MOR', 'AGU', 'COL', 'QUE', 'HID', 'GUA', 'MEX', 'TAB']);

  const EVENT_TYPES = {
    formation: { label: 'Formation', glyph: '◆' },
    split: { label: 'Split', glyph: '⟁' },
    alliance: { label: 'Alliance', glyph: '⧉' },
    capture: { label: 'Capture', glyph: '⊘' },
    killing: { label: 'Killing', glyph: '✕' },
    massacre: { label: 'Massacre', glyph: '✚' },
    escape: { label: 'Escape', glyph: '↗' },
    extradition: { label: 'Extradition', glyph: '⇥' },
    battle: { label: 'Battle', glyph: '⚔' },
    attack: { label: 'Attack', glyph: '✦' },
    policy: { label: 'Policy', glyph: '§' },
    trial: { label: 'Trial', glyph: '⚖' },
    corruption: { label: 'Corruption', glyph: '¤' },
    discovery: { label: 'Discovery', glyph: '⌖' },
    other: { label: 'Event', glyph: '•' },
  };

  const ERAS = [
    { key: 'e1', from: 1980, to: 1989, title: 'The Guadalajara era' },
    { key: 'e2', from: 1990, to: 1999, title: 'The plaza wars' },
    { key: 'e3', from: 2000, to: 2006, title: 'Democracy and fragmentation' },
    { key: 'e4', from: 2007, to: 2010, title: "Calderón's war" },
    { key: 'e5', from: 2011, to: 2014, title: 'Peak violence, new players' },
    { key: 'e6', from: 2015, to: 2018, title: 'CJNG ascendant' },
    { key: 'e7', from: 2019, to: 2022, title: 'Hugs, not bullets' },
    { key: 'e8', from: 2023, to: 2026, title: 'Fentanyl, fracture, terror lists' },
  ];

  return { ORG_META, ORG_ORDER, STATES, SMALL_STATES, EVENT_TYPES, ERAS, YEAR_MIN: 1980, YEAR_MAX: 2026 };
})();
