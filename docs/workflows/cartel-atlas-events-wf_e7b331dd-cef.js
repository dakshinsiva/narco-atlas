export const meta = {
  name: 'cartel-atlas-events',
  description: 'Research and adversarially fact-check major Mexican cartel events 1980-2026 by era, plus era narratives',
  phases: [
    { title: 'Research', detail: 'one researcher per era + narrative writer' },
    { title: 'Verify', detail: 'adversarial fact-check of each era batch as it lands' },
  ],
}

const PRE = `You are a research analyst compiling a rigorous, sourced dataset on Mexican organized crime (1980 to September 2026) for an interactive historical atlas ("Cartel Atlas"). Today's date is 2026-09-08. Accuracy beats volume: every date, place, coordinate and attribution must be right.
TOOLS: First call ToolSearch with query "select:WebSearch,WebFetch" to load the web tools, then use them to confirm specifics. Web verification is MANDATORY for anything from 2024-2026 (beyond most training data) and for any exact date or coordinate you are not certain of. Prefer InSight Crime, Reuters, AP, BBC, NYT, Washington Post, El Universal, Milenio, Animal Politico, Proceso, Justice in Mexico (Univ. of San Diego), Crisis Group, Congressional Research Service, DOJ/DEA/Treasury press releases, INEGI/SESNSP. Use Wikipedia as an index, not the final word.
OUTPUT: Return data via the StructuredOutput tool exactly matching the schema. Your final text is machine-read, never shown to a person: no prose outside the structure. Write text fields in clear English; keep Spanish names as written, with accents.
CANONICAL IDS (use exactly):
STATES (ISO 3166-2:MX): AGU Aguascalientes, BCN Baja California, BCS Baja California Sur, CAM Campeche, CHP Chiapas, CHH Chihuahua, CMX Ciudad de México, COA Coahuila, COL Colima, DUR Durango, GUA Guanajuato, GRO Guerrero, HID Hidalgo, JAL Jalisco, MEX Estado de México, MIC Michoacán, MOR Morelos, NAY Nayarit, NLE Nuevo León, OAX Oaxaca, PUE Puebla, QUE Querétaro, ROO Quintana Roo, SLP San Luis Potosí, SIN Sinaloa, SON Sonora, TAB Tabasco, TAM Tamaulipas, TLA Tlaxcala, VER Veracruz, YUC Yucatán, ZAC Zacatecas.
ORGANIZATIONS: guadalajara (Guadalajara Cartel, 1980-89) | sinaloa (Sinaloa Cartel / Federation as a whole) | chapitos (Los Chapitos faction) | mayiza (La Mayiza / Zambada faction) | beltran_leyva (Beltrán Leyva Organization) | tijuana (Tijuana Cartel / Arellano Félix Org, incl. later CTNG) | juarez (Juárez Cartel / Carrillo Fuentes Org incl. La Línea and Nuevo Cartel de Juárez) | gulf (Gulf Cartel incl. Metros, Ciclones/Escorpiones, Rojos factions) | zetas (Los Zetas, 1999-c.2015) | cdn (Cártel del Noreste) | zetas_vieja_escuela | milenio (Milenio / Valencia Cartel) | cjng (Cártel Jalisco Nueva Generación) | colima (Amezcua Contreras / Colima meth cartel) | sonora (Caro Quintero brothers' Sonora cartel, 1990s-2000s) | caborca (Caborca Cartel) | oaxaca (Díaz Parada organization) | familia_michoacana (La Familia Michoacana, 2006-c.2011) | templarios (Knights Templar) | nueva_familia_michoacana (Hurtado brothers) | carteles_unidos (Cárteles Unidos incl. Los Viagras, Cártel de Tepalcatepec, Blancos de Troya) | santa_rosa_lima | guerreros_unidos | rojos (Los Rojos) | cida (Cártel Independiente de Acapulco) | pacifico_sur | ardillos | tlacos | union_tepito | anti_union (Fuerza Anti-Unión) | tlahuac (Cártel de Tláhuac) | barredora (La Barredora, Tabasco) | talibanes (Los Talibanes, Zacatecas/SLP) | mezcales (Los Mezcales, Colima) | chiapas_guatemala (Cártel de Chiapas y Guatemala) | autodefensas (self-defense militias) | government (Mexican federal/state forces) | us_government | other (name the group in the text).`

const ERAS = [
  { key: 'e1', label: 'The Guadalajara era, 1980-1989', from: 1980, to: 1989,
    must: `Guadalajara Cartel consolidation under Félix Gallardo, Caro Quintero and Fonseca Carrillo (c.1980) and its Sinaloan roots (Operation Condor 1977 exodus, Pedro Avilés); Matta-Ballesteros/Medellín cocaine link; Rancho Búfalo raid (Nov 1984); Enrique 'Kiki' Camarena kidnapping and murder (Feb-Mar 1985) and Operation Leyenda; Caro Quintero arrest in Costa Rica and Fonseca Carrillo arrest (Apr 1985); Pablo Acosta killed at Santa Elena, Chihuahua (Apr 1987); the reported 1987 Acapulco meeting dividing plazas (Tijuana to Arellano Félix, Juárez to Aguilar Guajardo/Carrillo Fuentes, Pacific to Guzmán/Palma/Zambada, Sonora to Caro Quintero clan); Félix Gallardo arrest (Apr 8 1989); Juan García Ábrego's Gulf Cartel and its Cali cocaine arrangement; Arellano Félix brothers take Tijuana; Amado Carrillo Fuentes in Ojinaga/Juárez; Amezcua brothers' Colima meth trade begins; Pedro Díaz Parada in Oaxaca; US anti-drug certification law (1986); Héctor 'El Güero' Palma's family killed by Clavel (1989); Salinas takes office (Dec 1988).` },
  { key: 'e2', label: 'The plaza wars, 1990-1999', from: 1990, to: 1999,
    must: `Christine discotheque shootout, Puerto Vallarta (Nov 8 1992); Rafael Aguilar Guajardo killed in Cancún (Apr 1993); Cardinal Posadas Ocampo killed at Guadalajara airport (May 24 1993); El Chapo arrested in Guatemala (June 9 1993); Colosio assassination in Tijuana (Mar 23 1994, context); El Güero Palma arrest (June 1995); García Ábrego captured in Monterrey (Jan 14 1996); drug czar Gen. Gutiérrez Rebollo arrested (Feb 1997); Amado Carrillo Fuentes dies after surgery (July 4 1997) and the surgeons' bodies (Nov 1997); Vicente Carrillo takes Juárez; Ramón Arellano Félix on FBI Ten Most Wanted (1997); Operation Casablanca (May 1998); Amezcua brothers arrested (June 1998); Ensenada massacre (Sept 17 1998); Osiel Cárdenas takes the Gulf Cartel by killing Salvador 'El Chava' Gómez (1999) and founds Los Zetas with Arturo Guzmán Decena (1999); Osiel's standoff with DEA/FBI agents in Matamoros (Nov 9 1999); Colombian cartels' fall shifting power to Mexicans (1993-95); Ley Federal contra la Delincuencia Organizada (1996); Caro Quintero brothers' Sonora organization.` },
  { key: 'e3', label: 'Democracy and fragmentation, 2000-2006', from: 2000, to: 2006,
    must: `Fox wins presidency ending 71 years of PRI (July 2 2000); El Chapo escapes Puente Grande (Jan 19 2001); Sinaloa Federation with Beltrán Leyva, Zambada, Coronel (2001-02); Ramón Arellano Félix killed in Mazatlán (Feb 10 2002); Benjamín Arellano Félix arrested in Puebla (Mar 9 2002); Z-1 Arturo Guzmán Decena killed in Matamoros (Nov 21 2002); Osiel Cárdenas captured in Matamoros (Mar 14 2003); Armando Valencia (Milenio) arrested (Aug 2003); Nuevo Laredo war 2003-06 (Sinaloa/Los Negros/La Barbie vs Zetas); Rodolfo Carrillo Fuentes killed in Culiacán (Sept 11 2004) starting the Sinaloa-Juárez war; Arturo Guzmán Loera killed in Altiplano prison (Dec 31 2004); Nuevo Laredo police chief Alejandro Domínguez killed hours after taking office (June 8 2005) and Operativo México Seguro; Acapulco war (2005-06, BLO/Los Pelones vs Zetas); Miguel Caro Quintero extradition? (verify); five severed heads in Uruapan and La Familia Michoacana's debut (Sept 6 2006); Javier Arellano Félix captured at sea (Aug 14 2006); Calderón inaugurated (Dec 1 2006) and Operativo Conjunto Michoacán (Dec 11 2006); Zetas expansion into Michoacán/Veracruz/Guerrero.` },
  { key: 'e4', label: "Calderón's war, 2007-2010", from: 2007, to: 2010,
    must: `Osiel Cárdenas extradited (Jan 19 2007); Zhenli Ye Gon cash seizure (Mar 2007); Alfredo 'El Mochomo' Beltrán Leyva arrested (Jan 21 2008) and the BLO-Sinaloa split; Operativo Conjunto Chihuahua and the Juárez war (2008); Édgar Guzmán killed in Culiacán (May 8 2008); Mérida Initiative signed (June 30 2008); Creel massacre (Aug 16 2008); Morelia Independence Day grenade attack (Sept 15 2008); Michoacanazo (May 26 2009); Vicente Zambada Niebla arrested (Mar 2009); Arturo Beltrán Leyva killed in Cuernavaca (Dec 16 2009); Villas de Salvárcar massacre (Jan 31 2010); Gulf-Zetas split (Jan-Mar 2010); US consulate employees killed in Juárez (Mar 13 2010); Rodolfo Torre Cantú assassinated (June 28 2010); Juárez car bomb (July 15 2010); Nacho Coronel killed in Zapopan (July 29 2010) and CJNG's emergence; Edelmiro Cavazos killed (Aug 2010); San Fernando 72 migrants (Aug 22-24 2010); La Barbie arrested (Aug 30 2010); Tony Tormenta killed in Matamoros (Nov 5 2010); Ciudad Mier exodus (Nov 2010); Nazario Moreno's staged death (Dec 9 2010); Sinaloa-BLO war in Sinaloa/Sonora/Guerrero; Zetas blockades in Monterrey (2010).` },
  { key: 'e5', label: 'Peak violence and new players, 2011-2014', from: 2011, to: 2014,
    must: `Allende massacre, Coahuila (Mar 2011); Knights Templar founded (Mar 2011); San Fernando mass graves (Apr 2011); Durango mass graves (Apr 2011); Casino Royale arson, Monterrey (Aug 25 2011); 35 bodies in Boca del Río and the 'Matazetas' (Sept 20 2011); 26 bodies at Arcos del Milenio, Guadalajara (Nov 24 2011); Apodaca prison massacre and escape (Feb 19 2012); Nuevo Laredo hangings (May 4 2012) and Cadereyta 49 bodies (May 13 2012); Piedras Negras prison as Zetas killing site (2012, discovered later); Heriberto Lazcano killed in Progreso, Coahuila (Oct 7 2012); Peña Nieto inaugurated (Dec 1 2012); Michoacán autodefensas rise (Feb 24 2013); Heaven bar kidnapping, Mexico City (May 26 2013); Z-40 captured (July 15 2013); Caro Quintero released (Aug 9 2013); Gulf's Mario Ramírez Treviño captured (Aug 17 2013); Navy takes over Lázaro Cárdenas port (Nov 4 2013); federal commissioner Alfredo Castillo in Michoacán (Jan 2014); El Chapo captured in Mazatlán (Feb 22 2014); Nazario Moreno killed for real (Mar 9 2014); Enrique Plancarte killed (Mar 31 2014); Mireles arrested (June 27 2014); Tlatlaya killings (June 30 2014); Ayotzinapa 43 students disappeared in Iguala (Sept 26 2014); Héctor Beltrán Leyva arrested (Oct 1 2014); Vicente Carrillo Fuentes arrested (Oct 9 2014); Zetas vs Sinaloa/Gulf fighting in Zacatecas and Coahuila.` },
  { key: 'e6', label: 'CJNG ascendant, 2015-2018', from: 2015, to: 2018,
    must: `La Tuta captured (Feb 27 2015); Z-42 Omar Treviño captured (Mar 4 2015); CJNG named under Kingpin Act (Apr 2015); CJNG ambush kills 15 police at Soyatán (Apr 6 2015); Jalisco 'Black Friday' and army helicopter shot down (May 1 2015); Tanhuato/Rancho del Sol (May 22 2015); El Chapo tunnel escape from Altiplano (July 11 2015); El Chapo recaptured in Los Mochis (Jan 8 2016); Zetas fracture into CDN and Zetas Vieja Escuela (2015-16); Chapitos kidnapped in Puerto Vallarta by CJNG (Aug 15 2016); Sinaloa ambush kills 5 soldiers near Culiacán (Sept 30 2016); El Chapo extradited (Jan 19 2017); 'H2' Juan Francisco Patrón Sánchez killed in Tepic (Feb 9-10 2017); Nayarit prosecutor Edgar Veytia arrested in US (Mar 2017); journalists Miroslava Breach (Mar 23 2017) and Javier Valdez (May 15 2017) murdered; Dámaso López arrested (May 2 2017); Mini Lic surrenders (July 2017); Cártel de Tláhuac leader El Ojos killed (July 20 2017); Guanajuato huachicol war CSRL vs CJNG (2017-18); Los Cabos/La Paz violence peak (2017); 2017 sets homicide record; Tijuana homicide record (2018); 2018 election violence; AMLO wins (July 1 2018) and takes office promising 'abrazos no balazos' (Dec 1 2018); El Chapo trial opens in Brooklyn (Nov 13 2018); Colima with the highest homicide rate (2016-18).` },
  { key: 'e7', label: 'Hugs not bullets, 2019-2022', from: 2019, to: 2022,
    must: `Tlahuelilpan pipeline explosion (Jan 18 2019, huachicol context); El Chapo convicted (Feb 12 2019) and sentenced to life (July 17 2019); National Guard created (2019); Minatitlán massacre (Apr 19 2019); Caballo Blanco bar arson in Coatzacoalcos (Aug 27 2019); Culiacanazo (Oct 17 2019); LeBarón massacre near Bavispe (Nov 4 2019); Genaro García Luna arrested in Dallas (Dec 9 2019); 2019 homicide record (34,000+); Irapuato rehab centre massacre (July 1 2020); attack on Omar García Harfuch in Mexico City (June 26 2020); CJNG armored convoy video (July 2020); El Marro arrested (Aug 2 2020); Gen. Cienfuegos arrested in Los Angeles (Oct 15 2020), released (Nov 2020) and exonerated by Mexico (Jan 2021); Aguililla siege and CJNG drone attacks (2020-21); 2021 election violence; Reynosa massacre of civilians (June 19 2021); Zacatecas war CJNG vs Sinaloa (2021-22); Tulum shooting of tourists (Oct 20 2021); Chiapas Sinaloa-CJNG war begins around Frontera Comalapa (2021); 10 bodies dumped outside Zacatecas governor's palace (Jan 6 2022); San José de Gracia massacre (Feb 27 2022); Zinapécuaro cockfight massacre (Mar 27 2022); Caro Quintero captured in Choix and the Black Hawk crash killing 14 marines (July 15 2022); CJNG riots in Jalisco/Guanajuato (Aug 9 2022); Juárez prison riot and rampage (Aug 11 2022); Baja California narco-blockades (Aug 12 2022); Los Mezcales split from CJNG in Colima (2022); Antonio 'Tony Montana' Oseguera arrested (Dec 20 2022).` },
  { key: 'e8', label: 'Fentanyl, fracture and terror lists, 2023-2026', from: 2023, to: 2026,
    must: `El Neto prison break in Juárez (Jan 1 2023); Ovidio Guzmán captured in Jesús María (Jan 5 2023); García Luna convicted (Feb 21 2023); four Americans kidnapped in Matamoros (Mar 3 2023) and the Gulf Cartel 'apology'; US fentanyl indictments of Los Chapitos (Apr 14 2023); Hipólito Mora killed (June 29 2023); Lagos de Moreno five youths (Aug 11 2023); Ovidio extradited (Sept 15 2023); Chapitos 'fentanyl ban' banners (Oct 2023); Texcaltitlán villagers kill LFM extortionists (Dec 8 2023); Chiapas displacement from Sinaloa-CJNG war (2023-24); 2024 election violence and Sheinbaum's win (June 2 2024); El Mayo Zambada and Joaquín Guzmán López detained in El Paso (July 25 2024); Rocha Moya/Héctor Cuén killing controversy; Sinaloa civil war Chapitos vs Mayiza begins (Sept 9 2024); Sheinbaum takes office (Oct 1 2024); García Luna sentenced to 38 years (Oct 16 2024); record fentanyl seizure in Ahome (Dec 3 2024); Trump takes office and orders cartel FTO review (Jan 20 2025); FTO designation of Sinaloa, CJNG, CDN, Gulf, LNFM, Cárteles Unidos (Feb 20 2025); Mexico transfers 29 capos including Caro Quintero, Z-40, Z-42, Vicente Carrillo (Feb 27 2025); Rancho Izaguirre, Teuchitlán (Mar 5 2025); Ovidio's relatives cross into the US (May 9 2025); Ovidio pleads guilty (July 11 2025); second transfer of 26 (Aug 12 2025); El Mayo pleads guilty (Aug 25 2025); Hernán Bermúdez Requena arrested in Paraguay (Sept 12 2025); Carlos Manzo assassinated in Uruapan (Nov 1 2025) and Plan Michoacán; Gen Z protests (Nov 15 2025); El Mayo sentencing (Jan 2026, verify date and sentence); the reported killing of El Mencho in Tapalpa, Jalisco (Feb 2026: VERIFY with multiple independent sources; include only if confirmed, with the correct date and the retaliation that followed); Sinaloa war toll through 2026; World Cup 2026 security (June-July 2026); any US military action against cartels in or near Mexico in 2025-26 (verify carefully); the most important captures, killings and policy moves from March through September 8 2026 (research thoroughly).` },
]

const TYPES = ['formation','split','alliance','capture','killing','massacre','escape','extradition','battle','attack','policy','trial','corruption','discovery','other']

const EVENT_ITEM = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'kebab-case unique id starting with the year, e.g. 1985-camarena-murder' },
    date: { type: 'string', description: 'YYYY-MM-DD; if only month known use day 01 and precision=month; if only year, 01-01 and precision=year' },
    precision: { type: 'string', enum: ['day','month','year'] },
    title: { type: 'string', description: 'at most 70 characters' },
    summary: { type: 'string', description: '2-4 sentences: what happened, who, where' },
    impact: { type: 'string', description: '1-2 sentences: why it mattered / what changed' },
    state: { type: 'string', description: 'ISO 3166-2:MX code, or US, or MULTI' },
    city: { type: 'string' },
    lat: { type: 'number' },
    lng: { type: 'number' },
    cartels: { type: 'array', items: { type: 'string' }, description: 'canonical org ids involved' },
    figures: { type: 'array', items: { type: 'string' }, description: 'full names of key people' },
    type: { type: 'string', enum: TYPES },
    importance: { type: 'integer', description: '1-5' },
    confidence: { type: 'string', enum: ['high','medium','low'] },
    sources: { type: 'array', items: { type: 'string' }, description: '1-3 URLs' },
  },
  required: ['id','date','precision','title','summary','impact','state','city','lat','lng','cartels','figures','type','importance','confidence','sources'],
}
const EVENTS_SCHEMA = { type: 'object', properties: { events: { type: 'array', items: EVENT_ITEM } }, required: ['events'] }
const VERIFIED_SCHEMA = {
  type: 'object',
  properties: {
    events: { type: 'array', items: EVENT_ITEM },
    corrections: { type: 'array', items: { type: 'string' }, description: 'one line per change: id - what changed - evidence' },
    flagged: { type: 'array', items: { type: 'string' }, description: 'remaining doubts: id - concern' },
  },
  required: ['events','corrections','flagged'],
}
const NARR_SCHEMA = {
  type: 'object',
  properties: {
    intro: { type: 'string' },
    epilogue_2026: { type: 'string' },
    chapters: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' }, title: { type: 'string' }, subtitle: { type: 'string' }, narrative: { type: 'string' },
      shifts: { type: 'array', items: { type: 'string' } }, focus_states: { type: 'array', items: { type: 'string' } }, dominant_orgs: { type: 'array', items: { type: 'string' } },
    }, required: ['key','title','subtitle','narrative','shifts','focus_states','dominant_orgs'] } },
  },
  required: ['intro','epilogue_2026','chapters'],
}

function researchPrompt(e) {
  return `${PRE}

TASK: Compile the definitive event list for "${e.label}" (${e.from}-${e.to} inclusive). Return 30-40 events, the most consequential first if you must cut. Cover leadership captures and killings, cartel formations/splits/alliances, landmark massacres and attacks, the start and end of turf wars, major Mexican and US government operations and policy shifts, extraditions and trials, corruption scandals, and discoveries (mass graves, camps). You MUST include at least these, each verified: ${e.must}
Then add the other events of this era that a serious historian would consider essential, including at least a few from states outside the usual spotlight when they were significant.
RULES: exact dates (precision=day whenever knowable); lat/lng of the actual place (town/city centroid in decimal degrees, e.g. Culiacán 24.8091,-107.3940; Ciudad Juárez 31.6904,-106.4245; Tijuana 32.5149,-117.0382; Guadalajara 20.6597,-103.3496); state = code of the place (US with real US coordinates for US events; MULTI only if truly nationwide, then use Mexico City 19.4326,-99.1332); cartels[] uses canonical org ids only; figures[] full names as commonly written (e.g. "Joaquín 'El Chapo' Guzmán"); importance 5 = defining national moment, 4 = major, 3 = significant regional, 2 = notable, 1 = minor; no duplicates; 1-3 real source URLs per event; every event dated within ${e.from}-${e.to}.`
}

function verifyPrompt(e, batch) {
  return `${PRE}

ROLE: Adversarial fact-checker. Below is the researched event batch for "${e.label}". Assume it contains errors and hunt for them. For EVERY event check: (1) the exact date and precision; (2) the place, the state code, and that lat/lng really is the named town (spot-check against coordinates you know or look up); (3) the cartel and figure attributions; (4) each factual claim in summary and impact (numbers, names, sequence); (5) whether importance is calibrated (5 = defining national moment, 1 = minor). Use the web tools for anything you are not certain of, and for everything dated 2024-2026. Fix what is wrong. Set confidence to "low" for claims you could not confirm. Remove an event only if it is fabricated, outside ${e.from}-${e.to}, or a duplicate. Do NOT add new events. Keep ids stable. Return the FULL corrected batch, a corrections log (one line per change: id - what changed - evidence), and a flagged list of remaining doubts.

BATCH:
${JSON.stringify(batch.events)}`
}

function narrPrompt() {
  const list = ERAS.map(e => `${e.key}: ${e.label}`).join('; ')
  return `${PRE}

TASK: Write the narrative chapters for the atlas timeline. Chapters (use these keys exactly): ${list}. For each chapter return: key; title (at most 40 characters, evocative but accurate); subtitle (one line); narrative (220-300 words, vivid but strictly factual, chronological, naming the decisive people, places and dates); shifts (4-6 one-line "what changed" bullets); focus_states (3-6 state codes where the action was); dominant_orgs (canonical org ids that defined the era, most powerful first). Also return intro (about 120 words: what the atlas shows, how to read the map: fill colour = dominant organization, striped fill = actively contested, glowing markers = events) and epilogue_2026 (150-200 words on where things stand as of September 2026: Sinaloa civil war, CJNG after early 2026 (verify what happened to El Mencho), US terrorist designations and transfers, Sheinbaum's strategy, the fentanyl trade, homicide trends). Research 2025-2026 with the web tools before writing.`
}

phase('Research')
log('Researching 8 eras in parallel; each batch is adversarially fact-checked as soon as it lands')
const narrP = agent(narrPrompt(), { label: 'narratives', phase: 'Research', schema: NARR_SCHEMA })
const eras = await pipeline(ERAS,
  e => agent(researchPrompt(e), { label: `events:${e.key}`, phase: 'Research', schema: EVENTS_SCHEMA }),
  (r, e) => (r && r.events && r.events.length)
    ? agent(verifyPrompt(e, r), { label: `verify:${e.key}`, phase: 'Verify', schema: VERIFIED_SCHEMA, effort: 'high' }).then(v => ({ researched: r, verified: v }))
    : null,
)
const narratives = await narrP
const out = ERAS.map((e, i) => ({ era: e.key, label: e.label, from: e.from, to: e.to, result: eras[i] }))
const total = out.reduce((n, x) => n + (((x.result && x.result.verified && x.result.verified.events) || (x.result && x.result.researched && x.result.researched.events) || []).length), 0)
const missing = out.filter(x => !x.result).map(x => x.era)
if (missing.length) log(`WARNING: no result for eras ${missing.join(', ')}`)
log(`Done: ${total} events across ${out.length} eras`)
return { eras: out, narratives }