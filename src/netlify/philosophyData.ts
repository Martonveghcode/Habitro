import { PHILOSOPHY_ANKI_SEEDS } from "./philosophyAnkiData";

export type PhilosophyCardSource = "anki" | "book";

export interface PhilosophyChapter {
  id: string;
  shortTitle: string;
  title: string;
}

export interface PhilosophyCard {
  id: string;
  chapterId: string;
  chapterTitle: string;
  section: string;
  question: string;
  answer: string;
  source: PhilosophyCardSource;
  ankiId?: number;
}

interface BookCardSeed {
  chapterId: string;
  section: string;
  question: string;
  answer: string;
}

export const PHILOSOPHY_CHAPTERS: PhilosophyChapter[] = [
  {
    id: "tema-1",
    shortTitle: "Tema 1",
    title: "El saber filosófico",
  },
  {
    id: "tema-2",
    shortTitle: "Tema 2",
    title: "La dimensión psicobiológica del ser humano",
  },
  {
    id: "tema-3",
    shortTitle: "Tema 3",
    title: "La persona: naturaleza y cultura",
  },
  {
    id: "tema-4",
    shortTitle: "Tema 4",
    title: "Conocimiento, verdad y lenguaje",
  },
  {
    id: "tema-7",
    shortTitle: "Tema 7",
    title: "La apariencia y la realidad",
  },
  {
    id: "tema-8",
    shortTitle: "Tema 8",
    title: "La dimensión ética del ser humano",
  },
];

const chapterById = new Map(PHILOSOPHY_CHAPTERS.map((chapter) => [chapter.id, chapter]));

const BOOK_CARD_SEEDS: BookCardSeed[] = [
  {
    chapterId: "tema-1",
    section: "1.1 · El saber buscado",
    question: "¿De dónde procede la palabra «filosofía» y qué significa?",
    answer:
      "La palabra **filosofía** procede del griego y se compone de la raíz *philos* («amor») y el sustantivo *sophía* («sabiduría»). El filósofo sería, simplemente, el **amante o buscador de la sabiduría**.",
  },
  {
    chapterId: "tema-1",
    section: "1.1 · El saber buscado",
    question: "¿Cómo distingue Platón entre sabios, necios y filósofos?",
    answer:
      "- El **sabio** ya sabe todo acerca de todas las cosas.\n- Los **necios** ignoran casi todo, pero viven satisfechos en su ignorancia.\n- Los **filósofos** no saben muchas cosas, pero saben que no saben y por eso no dejan de hacerse preguntas.",
  },
  {
    chapterId: "tema-1",
    section: "1.1 · El saber buscado",
    question: "¿Por qué se dice que el filósofo está siempre en camino?",
    answer:
      "Porque no termina nunca de poseer aquello que busca. En su búsqueda llega a las regiones extremas de la realidad, donde se alzan las preguntas últimas: **¿quién soy yo?, ¿qué sentido tiene la vida?...**",
  },
  {
    chapterId: "tema-1",
    section: "1.2 · Filosofamos para vivir",
    question: "¿Por qué filosofamos?",
    answer:
      "Porque secundamos un impulso que brota del corazón de todo ser humano. Como decía Aristóteles en su *Metafísica*, «todos los hombres desean por naturaleza saber». Estamos, en cierto modo, **hechos para buscar**.",
  },
  {
    chapterId: "tema-1",
    section: "1.2 · Filosofamos para vivir",
    question: "¿Cuáles son los tres «resortes» que lanzan al ser humano a la búsqueda del saber?",
    answer: "El **asombro**, la **duda** y la **conmoción existencial**.",
  },
  {
    chapterId: "tema-1",
    section: "1.2 · Filosofamos para vivir",
    question: "¿Qué es el asombro filosófico?",
    answer:
      "El asombro es la sorpresa que sentimos ante algo extraordinario o inesperado. Implica tomar conciencia de que hay algo que se nos escapa en aquello que creíamos conocer. El reconocimiento de la propia ignorancia despierta las preguntas y la búsqueda.",
  },
  {
    chapterId: "tema-1",
    section: "1.2 · Filosofamos para vivir",
    question: "¿Qué significa dudar filosóficamente?",
    answer:
      "Dudar quiere decir **someter a crítica lo que sabemos o creemos saber** con vistas a avanzar en el conocimiento y a profundizar en lo ya conocido.",
  },
  {
    chapterId: "tema-1",
    section: "1.2 · Filosofamos para vivir",
    question: "¿Qué es la conmoción existencial?",
    answer:
      "Es la sacudida que producen ciertos acontecimientos y que nos despierta de una vida absorbida por metas inmediatas y pragmáticas, abriendo de nuevo el asombro y los interrogantes.",
  },
  {
    chapterId: "tema-1",
    section: "1.2 · Filosofamos para vivir",
    question: "¿Cuáles son las situaciones límite de Karl Jaspers?",
    answer: "La **muerte**, el **dolor**, el **azar**, la **lucha** y la **culpa**.",
  },
  {
    chapterId: "tema-1",
    section: "2.1 · El paso del mito al logos",
    question: "¿Qué es el mito?",
    answer:
      "Un conjunto de narraciones tradicionales que proporcionaron al ser humano las primeras explicaciones acerca del cosmos y de él mismo.",
  },
  {
    chapterId: "tema-1",
    section: "2.1 · El paso del mito al logos",
    question: "¿Cuáles son las características de los relatos míticos?",
    answer:
      "Son **cosmogónicos**, **imaginativos y simbólicos**, **antropomorfos**, **tradicionales** y de **carácter religioso**.",
  },
  {
    chapterId: "tema-1",
    section: "2.1 · El paso del mito al logos",
    question: "¿Qué significa que los mitos son cosmogónicos?",
    answer:
      "Que intentan explicar el origen del cosmos y del ser humano y presentan una visión global del universo.",
  },
  {
    chapterId: "tema-1",
    section: "2.1 · El paso del mito al logos",
    question: "¿Qué significa que los mitos son imaginativos y simbólicos?",
    answer:
      "Que narran acontecimientos remotos protagonizados por dioses y personajes legendarios, abundan en símbolos y son más fruto de la imaginación que de una actividad discursiva o lógica. Por eso se expresan en un lenguaje poético.",
  },
  {
    chapterId: "tema-1",
    section: "2.1 · El paso del mito al logos",
    question: "¿Qué significa que los mitos son antropomorfos?",
    answer:
      "Que personifican los fenómenos naturales, pues detrás de ellos sitúan la acción de dioses concebidos a la manera humana.",
  },
  {
    chapterId: "tema-1",
    section: "2.1 · El paso del mito al logos",
    question: "¿Qué significa que los mitos son tradicionales?",
    answer:
      "Que acumulan la sabiduría legada por las generaciones anteriores y se asumen como un valioso tesoro heredado de los antepasados.",
  },
  {
    chapterId: "tema-1",
    section: "2.1 · El paso del mito al logos",
    question: "¿Por qué los mitos tienen carácter religioso?",
    answer:
      "Porque la necesidad de explicar lo que sucede y controlar la realidad llevó a asociarlos a ritos religiosos, mediante los cuales los humanos intentaban atraer el favor de los dioses.",
  },
  {
    chapterId: "tema-1",
    section: "2.1 · El paso del mito al logos",
    question: "¿En qué consistió el paso del mito al logos?",
    answer:
      "Los sabios apelaron más al **intelecto —al logos— que a la imaginación**, emplearon un discurso conceptual que daba razones de las cosas y reflexionaron sobre las regularidades, leyes o principios que la razón puede descubrir bajo las apariencias sensibles.",
  },
  {
    chapterId: "tema-1",
    section: "2.1 · El paso del mito al logos",
    question: "¿Qué significa «logos»?",
    answer:
      "Significa «expresión», «palabra», «discurso» o «razón»; también «ley» o «principio». Puede entenderse como el discurso inteligible o razonado y como la razón universal que hace posible que el mundo tenga un orden y un sentido.",
  },
  {
    chapterId: "tema-1",
    section: "2.2 · Grecia, cuna de la filosofía",
    question: "¿Qué circunstancias sociales y culturales favorecieron el nacimiento de la filosofía en Grecia?",
    answer:
      "- El surgimiento y democratización de las **polis**.\n- La pérdida de vigencia de los valores aristocráticos y bélicos de los mitos.\n- Los intercambios con otros pueblos del Mediterráneo.\n- La importancia de la educación y de la formación literaria y moral.\n- El **ágora** como centro cultural y político, junto con la disponibilidad de tiempo libre para el conocimiento y la investigación.",
  },
  {
    chapterId: "tema-1",
    section: "3.1 · Características del saber filosófico",
    question: "¿Cuáles son las características del saber filosófico?",
    answer:
      "Es **universal**, **riguroso**, busca las **causas últimas** de las realidades y es **radical**.",
  },
  {
    chapterId: "tema-1",
    section: "3.1 · Características del saber filosófico",
    question: "¿Qué significa que la filosofía es universal y rigurosa?",
    answer:
      "- Es **universal** porque se interesa por la realidad en su conjunto y adopta una perspectiva de globalidad.\n- Es **rigurosa** porque se sirve de un método e integra armónicamente la experiencia sensitiva, la abstracción intelectual, el razonamiento lógico y la argumentación discursiva.",
  },
  {
    chapterId: "tema-1",
    section: "3.1 · Características del saber filosófico",
    question: "¿Qué significa que la filosofía busca las causas últimas y es radical?",
    answer:
      "Aspira a desentrañar las **causas últimas** de la realidad. Es **radical** porque estudia el qué y el porqué de las cosas, busca su esencia y su sentido y se ocupa de las cuestiones últimas.",
  },
  {
    chapterId: "tema-1",
    section: "3.1 · Definición de filosofía",
    question: "¿Cuál es la definición de filosofía?",
    answer:
      "El saber de todos los seres acerca de sus causas últimas, saber que se adquiere mediante la luz natural de la razón.",
  },
  {
    chapterId: "tema-1",
    section: "3.1 · Características del saber filosófico",
    question: "¿Qué matices añade el libro a la definición de filosofía?",
    answer:
      "Sus respuestas no son definitivas; tiene un componente crítico; la realidad que intenta sondear es misteriosa, sin ser oscura o incomprensible; y la filosofía es libre, un **fin en sí misma** y no un medio para otra cosa.",
  },
  {
    chapterId: "tema-1",
    section: "3.2 · Otros modelos de saber",
    question: "¿Qué otros modelos de saber aparecen junto a la filosofía y la ciencia empírica?",
    answer: "El **arte**, la **teología** y la **tradición**.",
  },
  {
    chapterId: "tema-1",
    section: "3.2 · Otros modelos de saber",
    question: "¿Qué es el arte como modelo de saber?",
    answer:
      "Es una forma privilegiada de expresión de vivencias y conocimientos que no podrían transmitirse de otro modo en toda su hondura. Conoce mediante la **intuición creadora**, que transfigura la realidad.",
  },
  {
    chapterId: "tema-1",
    section: "3.2 · Otros modelos de saber",
    question: "¿Qué es la teología y qué relación tiene con la filosofía?",
    answer:
      "La teología es una reflexión de la razón a la luz de la fe que parte del dato revelado. Razón y fe son fuentes distintas de conocimiento, pero no se oponen, sino que se complementan.",
  },
  {
    chapterId: "tema-1",
    section: "3.2 · Otros modelos de saber",
    question: "¿Qué es la tradición y cómo debe asumirse?",
    answer:
      "Es el modo en que recibimos la visión de la vida, los conocimientos, los valores y las costumbres vigentes en nuestra cultura. No debe asumirse acríticamente: hay que hacerla propia, apreciar sus valores y abandonar lo que realmente carece de valor.",
  },
  {
    chapterId: "tema-1",
    section: "4.3 · Otras disciplinas",
    question: "¿Qué otras disciplinas filosóficas señala el libro?",
    answer:
      "La **filosofía de la naturaleza**; las «filosofías de» distintos saberes —filosofía de la ciencia, del arte, de la historia, etc.—; y la **historia de la filosofía**, que analiza las respuestas dadas a los problemas filosóficos a lo largo del pensamiento.",
  },
  {
    chapterId: "tema-1",
    section: "5.1 · El enigma de la muerte",
    question: "¿Qué peculiaridad tiene la muerte para el ser humano?",
    answer:
      "Los humanos no solo morimos, sino que **sabemos que vamos a morir**. Ante este hecho sentimos una angustia metafísica ante la incertidumbre del no-ser, distinta de un simple miedo o instinto biológico.",
  },
  {
    chapterId: "tema-1",
    section: "5.1 · El enigma de la muerte",
    question: "¿Qué cuestión filosófica une el libro al enigma de la muerte?",
    answer:
      "La cuestión del **sentido**: si la muerte tuviera la última palabra, ¿tendría algún sentido vivir?, ¿hay algo capaz de hacer plena la vida?, ¿existe en nosotros un núcleo inmortal abierto a una dimensión más allá de esta vida?",
  },
  {
    chapterId: "tema-1",
    section: "5.2 · La cuestión del sentido",
    question: "¿Cuál es, según Albert Camus, la pregunta fundamental de la filosofía?",
    answer:
      "«Juzgar que la vida vale o no vale la pena de que se la viva es responder a la pregunta fundamental de la filosofía».",
  },
  {
    chapterId: "tema-1",
    section: "5.3 · ¿Tiene un sentido la vida?",
    question: "¿Qué cuatro sentidos tiene la palabra «sentido»?",
    answer:
      "Puede significar **dirección**; **propósito o fin**; **significado**; **coherencia** entre una acción o palabra y su contexto; y, en fin, que algo es una **realidad valiosa** cuya existencia se justifica.",
  },

  {
    chapterId: "tema-2",
    section: "Página 13 · Primer interrogante",
    question: "¿Cuál es el origen del ser humano?",
    answer:
      "El origen humano se explica mediante dos procesos inseparables: la **hominización**, proceso biológico que desembocó en el *Homo sapiens sapiens*, y la **humanización**, aparición de rasgos culturales que hicieron posible una auténtica herencia cultural.",
  },
  {
    chapterId: "tema-2",
    section: "3.3 · La singularidad de la especie humana",
    question: "¿Qué es la hominización?",
    answer:
      "La hominización es el **proceso biológico** que desembocó en la aparición del *Homo sapiens sapiens* como especie diferenciada en la familia de los homínidos.",
  },
  {
    chapterId: "tema-2",
    section: "3.3 · La singularidad de la especie humana",
    question: "¿Qué singularidades morfológicas y funcionales destacan en la hominización?",
    answer:
      "- El aumento de la relación entre el tamaño del cerebro y el del cuerpo.\n- La nueva estructura del aparato fónico.\n- La transformación expresiva del rostro.\n- La estructura de la columna vertebral.\n- La transformación del pie.\n- La bipedestación.\n- La morfología de la mano y el pulgar oponible.",
  },
  {
    chapterId: "tema-2",
    section: "3.3 · La singularidad de la especie humana",
    question: "¿Cuál es el rasgo genérico más característico del cuerpo humano?",
    answer:
      "Su **inespecialización**: no está orientado exclusivamente a un hábitat o a unas funciones determinadas y ofrece posibilidades muy variadas, hasta el punto de que el ser humano adapta el medio a sus necesidades.",
  },
  {
    chapterId: "tema-2",
    section: "3.3 · La singularidad de la especie humana",
    question: "¿Qué es la humanización?",
    answer:
      "La humanización es el proceso de aparición de rasgos culturales que apuntan a la existencia de una auténtica especie humana, singularizada especialmente por actividades que posibilitan una herencia cultural.",
  },
  {
    chapterId: "tema-2",
    section: "3.3 · La singularidad de la especie humana",
    question: "¿Qué elementos básicos configuran una cultura humana en el proceso de humanización?",
    answer: "La **técnica**, la **ética**, la **religión**, el **arte** y el **lenguaje**.",
  },
  {
    chapterId: "tema-2",
    section: "3.3 · La singularidad de la especie humana",
    question: "¿Qué papel tienen la técnica y la ética en la humanización?",
    answer:
      "- La **técnica** encontró su condición de posibilidad en la mano y deja ver la inteligencia humana.\n- La **ética** es propia del ser humano porque desarrolla su vida libremente en sociedad y debe asumir normas imprescindibles para la convivencia.",
  },
  {
    chapterId: "tema-2",
    section: "3.3 · La singularidad de la especie humana",
    question: "¿Qué papel tienen el arte, la religión y el lenguaje en la humanización?",
    answer:
      "Las manifestaciones artísticas y religiosas son indicios de la **capacidad simbólica** que está en la base de la cultura. En el lenguaje, lo decisivo es la posibilidad del **diálogo**.",
  },
  {
    chapterId: "tema-2",
    section: "3.3 · Dos procesos y una sola dirección",
    question: "¿Cómo se relacionan hominización y humanización?",
    answer:
      "La aparición del ser humano supuso un **salto cualitativo** que no niega el proceso evolutivo. La evolución biológica no puede entenderse al margen de la humanización: la inespecialización corporal se compensa con la simbolización, el lenguaje y el anhelo de sentido y trascendencia.",
  },

  {
    chapterId: "tema-3",
    section: "Definiciones del DOCX",
    question: "¿Qué significa «persona»?",
    answer:
      "Mi propio ser, alguien distinto de los otros, pasa a primer plano («Yo soy... No soy Marta, Javier ni Sonia»). Nos referimos a esta realidad cuando utilizamos la palabra **persona**.",
  },
  {
    chapterId: "tema-3",
    section: "Definiciones del DOCX",
    question: "¿Qué es el ser humano?",
    answer:
      "El ser humano es persona porque se convierte en autor y actor de una narración única: su biografía, su propia vida.",
  },
  {
    chapterId: "tema-3",
    section: "Definiciones del DOCX",
    question: "¿Qué es la persona humana?",
    answer: "La persona humana es un ser cultural.",
  },
  {
    chapterId: "tema-3",
    section: "1.1 · La pregunta por el qué",
    question: "¿Qué se denomina clásicamente esencia o naturaleza?",
    answer:
      "Aquello que hace que una realidad sea lo que es y que le permite obrar en consecuencia.",
  },
  {
    chapterId: "tema-3",
    section: "1.1 · La pregunta por el qué",
    question: "¿Cuáles son las cuatro concepciones de la naturaleza humana que presenta el libro?",
    answer:
      "La concepción **naturalista o biologicista**, la **existencialista**, la **historicista** y la **humanista o personalista**.",
  },
  {
    chapterId: "tema-3",
    section: "1.1 · La pregunta por el qué",
    question: "¿Qué sostiene la concepción naturalista o biologicista?",
    answer:
      "Que la naturaleza humana no es más que un conjunto de tendencias físicas o biológicas. El pensamiento, los sentimientos y las pasiones son formas de la materia o energía, y el ser humano es una parte privilegiada de la naturaleza física.",
  },
  {
    chapterId: "tema-3",
    section: "1.1 · La pregunta por el qué",
    question: "¿Qué sostiene la concepción existencialista?",
    answer:
      "Que la esencia humana es la libertad. No existe una naturaleza humana previa, sino que cada uno ha de construirla o recrearla; lo humano sería simplemente elegir.",
  },
  {
    chapterId: "tema-3",
    section: "1.1 · La pregunta por el qué",
    question: "¿Qué sostiene la concepción historicista?",
    answer:
      "Que el ser humano está determinado o se construye mediante procesos históricos y culturales. Conduce a un relativismo cultural por el que carece de un bien o fin correspondiente a su modo de ser.",
  },
  {
    chapterId: "tema-3",
    section: "1.1 · La pregunta por el qué",
    question: "¿Qué sostiene la concepción humanista o personalista?",
    answer:
      "Que el ser humano está dotado de condiciones naturales que ha de perfeccionar. La naturaleza no es obstáculo para la libertad, sino el principio que permite su libre despliegue: el ser humano debe hacerse, pero **desde lo que es**.",
  },
  {
    chapterId: "tema-3",
    section: "1.2 · El descubrimiento del quién",
    question: "¿Qué expresa la pregunta «¿quién soy yo?»?",
    answer:
      "La propia condición única frente al resto de lo real y frente a los demás seres humanos. Mi propio ser, alguien distinto de los otros, pasa a primer plano: a esa realidad la llamamos **persona**.",
  },
  {
    chapterId: "tema-3",
    section: "1.3 · Las dimensiones de la persona",
    question: "¿Cuáles son las dimensiones de la persona?",
    answer:
      "La persona forma una unidad **bio-psico-espiritual** y sus dimensiones son la **corporal**, la **psicofísica**, la **espiritual** y la **sociocultural**.",
  },
  {
    chapterId: "tema-3",
    section: "1.3 · Las dimensiones de la persona",
    question: "¿En qué consiste la dimensión corporal de la persona?",
    answer:
      "La persona no tiene simplemente cuerpo: es «alguien corporal». El cuerpo forma parte del núcleo personal, participa de su dignidad y permite relacionarnos e interactuar con el mundo y con los demás.",
  },
  {
    chapterId: "tema-3",
    section: "1.3 · Las dimensiones de la persona",
    question: "¿En qué consiste la dimensión psicofísica de la persona?",
    answer:
      "La persona posee tendencias e inclinaciones que le permiten captar bienes sensibles y afectivos. Las pasiones y los sentimientos pueden condicionar o enriquecer su acción y sus vínculos; su razón y voluntad libre pueden regular las emociones y ordenar la acción a un fin.",
  },
  {
    chapterId: "tema-3",
    section: "1.3 · Las dimensiones de la persona",
    question: "¿En qué consiste la dimensión espiritual de la persona?",
    answer:
      "La persona es capaz de distanciarse y trascenderse a sí misma. Busca algo absoluto y, ante las situaciones límite, busca respuestas en el ámbito de los fundamentos y de los fines de su existencia.",
  },
  {
    chapterId: "tema-3",
    section: "1.3 · Las dimensiones de la persona",
    question: "¿En qué consiste la dimensión sociocultural de la persona?",
    answer:
      "La persona está instalada social e históricamente: la sociabilidad la constituye. Es un ser cultural cuya vida se inscribe en una cultura desde la cual comienza a ejercer su libertad, define su mundo y puede transformarlo.",
  },
  {
    chapterId: "tema-3",
    section: "1.4 · Un intento de definición",
    question: "¿Qué caracteres manifiestan la condición única de cada ser humano?",
    answer:
      "El **carácter biográfico**, la **intimidad**, la **manifestación** y la **condición dialógica**.",
  },
  {
    chapterId: "tema-3",
    section: "1.4 · Un intento de definición",
    question: "¿Qué significa el carácter biográfico de la persona?",
    answer:
      "La pregunta por el quién se responde con una historia irrepetible. El ser humano es autor y actor de una narración única: su biografía, su propia vida.",
  },
  {
    chapterId: "tema-3",
    section: "1.4 · Un intento de definición",
    question: "¿Qué es la intimidad personal?",
    answer:
      "El núcleo personal interior gracias al cual nos experimentamos como alguien único, irrepetible e insustituible.",
  },
  {
    chapterId: "tema-3",
    section: "1.4 · Un intento de definición",
    question: "¿Qué es la manifestación de la persona?",
    answer:
      "La capacidad de expresar la intimidad, especialmente a través del cuerpo y del lenguaje. El pudor refleja el carácter único y original de esa intimidad.",
  },
  {
    chapterId: "tema-3",
    section: "1.4 · Un intento de definición",
    question: "¿Qué es la condición dialógica de la persona?",
    answer:
      "La apertura esencial a los demás: el yo no tiene sentido sin el tú. Lo más radical de la persona es su capacidad de darse a sí misma.",
  },
  {
    chapterId: "tema-3",
    section: "1.5 · ¿Son personas todos los seres humanos?",
    question: "¿En qué se diferencian el yo psicológico y el yo real?",
    answer:
      "El **yo psicológico** es el yo del que soy consciente y mediante el cual conozco mi identidad. Ese yo existe porque previamente soy un **yo real**: en mi ser ya hay un yo antes de que lo sepa.",
  },
  {
    chapterId: "tema-3",
    section: "1.5 · ¿Son personas todos los seres humanos?",
    question: "¿Qué diferencia hay entre la respuesta universalista y la restrictiva sobre quién es persona?",
    answer:
      "- La **universalista** funda el valor de la persona en el yo real y en la capacidad de pensar, obrar libremente o amar, aunque no pueda ejercerla.\n- La **restrictiva** identifica ser persona con ejercer actualmente el raciocinio, la autoconciencia, la empatía y la comunicación.",
  },
  {
    chapterId: "tema-3",
    section: "1.5 · La dignidad de la persona",
    question: "¿Qué significa la dignidad humana?",
    answer:
      "Que cada vida humana tiene un valor incomparable y que una persona vale por sí misma, no solo respecto a otras. No depende del sexo, inteligencia, raza, edad, salud ni de otra circunstancia.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · Persona, acción y libertad",
    question: "¿Qué diferencia hay entre los actos del hombre y los actos humanos?",
    answer:
      "- Los **actos del hombre** no necesitan realizarse voluntaria ni conscientemente.\n- En los **actos humanos** participan la inteligencia y la voluntad libre; son libres, conscientes y permiten a la persona gobernarse.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · Persona, acción y libertad",
    question: "¿Qué es una acción humana?",
    answer:
      "La conducta voluntaria de una persona que, guiada por su razón, decide actuar de un modo determinado con vistas a cierto propósito o fin.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · Estructura de la acción humana",
    question: "¿Cuáles son las fases de la estructura básica de la acción humana?",
    answer: "La **intención**, la **deliberación**, la **decisión**, la **ejecución** y la **satisfacción**.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · Estructura de la acción humana",
    question: "¿Qué ocurre en la intención, deliberación y decisión?",
    answer:
      "- **Intención:** la voluntad se inclina hacia un objetivo y necesita medios.\n- **Deliberación:** se reflexiona sobre los medios más adecuados.\n- **Decisión:** se elige la acción concreta y el modo de ponerla en práctica.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · Estructura de la acción humana",
    question: "¿Qué ocurre en la ejecución y la satisfacción?",
    answer:
      "- **Ejecución:** se realiza la acción mediante el medio elegido.\n- **Satisfacción:** es el goce que sigue a la ejecución si se alcanza el objetivo.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · La negación de la libertad",
    question: "¿Qué es el determinismo y qué tipos presenta el libro?",
    answer:
      "Es la postura que niega la libertad y atribuye el comportamiento a factores ajenos a la voluntad. Puede ser **materialista**, **sociológico**, **psicológico** o **metafísico/fatalista**.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · La negación de la libertad",
    question: "¿En qué consisten los determinismos materialista y sociológico?",
    answer:
      "- El **materialista** atribuye cuanto sucede a elementos y leyes físicas, biológicas o fisiológicas.\n- El **sociológico** sostiene que la presión social, las ideas dominantes, la clase o la educación anulan la libertad.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · La negación de la libertad",
    question: "¿En qué consisten los determinismos psicológico y metafísico?",
    answer:
      "- El **psicológico** sostiene que la voluntad está determinada por motivos psíquicos o inconscientes.\n- El **metafísico o fatalista** somete la voluntad al destino y considera aparentes las acciones voluntarias.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · Defensa de la libertad",
    question: "¿Qué argumentos ofrece el libro en defensa de la libertad?",
    answer:
      "La conciencia que tenemos de una libertad limitada pero real; la necesidad de la libertad para que tengan sentido la moral, la responsabilidad, el compromiso y los derechos; y la estructura motivada del acto voluntario, pues poder dar razones de lo que hacemos no elimina la libertad.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · Dimensiones de la libertad",
    question: "¿Cuáles son las dimensiones de la libertad?",
    answer:
      "La libertad como **ausencia de coacción**, como **capacidad de elección o libre albedrío** y como **libertad moral**, que es su plenitud.",
  },
  {
    chapterId: "tema-3",
    section: "2.1 · Dimensiones de la libertad",
    question: "¿Qué es la libertad moral?",
    answer:
      "Es la plenitud de la libertad: se incrementa con su ejercicio, hace al ser humano más dueño de sí, implica elegir lo conforme al bien más humano y pone el dominio de los actos al servicio de la perfección personal y social.",
  },
  {
    chapterId: "tema-3",
    section: "2.3 · La cultura y la sociedad",
    question: "¿Qué es la cultura?",
    answer:
      "El conjunto de conocimientos, actitudes y signos históricamente transmitidos de generación en generación mediante los cuales los seres humanos se comunican y organizan su vida en sociedad.",
  },
  {
    chapterId: "tema-3",
    section: "2.3 · La cultura y la sociedad",
    question: "¿Cuáles son los componentes de la cultura?",
    answer: "El **lenguaje**, los **valores**, las **normas sociales**, los **instrumentos** y los **signos**.",
  },
  {
    chapterId: "tema-3",
    section: "2.3 · La cultura y la sociedad",
    question: "¿Qué son los valores y las normas sociales?",
    answer:
      "- Los **valores** son cualidades que hacen apreciable o estimable una realidad y orientan la existencia.\n- Las **normas sociales** son reglas según las cuales se orienta la conducta social y concretan los valores en pautas definidas de obrar.",
  },
  {
    chapterId: "tema-3",
    section: "2.3 · La cultura y la sociedad",
    question: "¿Qué son los instrumentos y los signos culturales?",
    answer:
      "- Los **instrumentos** son los artefactos propios de cada sociedad.\n- Los **signos** son elementos con un significado particular reconocido por los miembros de una cultura.",
  },
  {
    chapterId: "tema-3",
    section: "2.4 · Persona, sociedad y trabajo",
    question: "¿Cuál es el sentido propio del trabajo?",
    answer:
      "La **realización integral del ser humano**, es decir, su desarrollo armónico. El ser humano es un ser que trabaja y puede transformar la realidad gracias a su inteligencia y su voluntad.",
  },
  {
    chapterId: "tema-3",
    section: "2.4 · Persona, sociedad y trabajo",
    question: "¿Cuáles son las dos dimensiones del trabajo?",
    answer:
      "- **Objetiva:** considera los resultados externos, las obras o bienes producidos.\n- **Subjetiva:** se centra en el sujeto y en la influencia que el trabajo ejerce sobre él y sobre los demás.",
  },

  {
    chapterId: "tema-4",
    section: "1.1 · Las dimensiones de la razón",
    question: "¿Cuáles son las dos dimensiones o usos de la razón?",
    answer: "La **racionalidad teórica** y la **racionalidad práctica**.",
  },
  {
    chapterId: "tema-4",
    section: "1.2 · La teoría del conocimiento",
    question: "¿Qué es la teoría del conocimiento?",
    answer:
      "La disciplina filosófica que estudia la **naturaleza**, el **alcance** y los **límites** del conocimiento humano.",
  },
  {
    chapterId: "tema-4",
    section: "1.2 · La teoría del conocimiento",
    question: "¿Qué otros nombres recibe la teoría del conocimiento y qué es la epistemología?",
    answer:
      "También recibe los nombres de **filosofía crítica** o **gnoseología**. Dentro de ella, la **epistemología** es el estudio específico del conocimiento científico positivo.",
  },
  {
    chapterId: "tema-4",
    section: "1.2 · La teoría del conocimiento",
    question: "¿Qué grandes problemas estudia la gnoseología?",
    answer:
      "La noción de conocimiento humano; su naturaleza y estructura; su expresión mediante el lenguaje; su fuente y alcance; y su relación con la verdad.",
  },
  {
    chapterId: "tema-4",
    section: "2.1 · La actividad cognoscitiva",
    question: "¿Por qué el conocimiento es una acción inmaterial e intencional?",
    answer:
      "Porque el sujeto posee la forma de lo conocido sin recibir su materia: el objeto pasa a estar presente de manera **inmaterial** en quien conoce. Es **intencional** porque remite al objeto conocido.",
  },
  {
    chapterId: "tema-4",
    section: "2.3 · Sujeto y objeto",
    question: "¿Qué son el sujeto y el objeto del conocimiento?",
    answer:
      "El **sujeto** es la conciencia y la persona concreta que ejerce su capacidad de conocer; el **objeto** es todo aquello que está ante la conciencia.",
  },
  {
    chapterId: "tema-4",
    section: "3 · Esquema del conocimiento humano",
    question: "¿Cómo se estructura el conocimiento humano?",
    answer:
      "En **conocimiento sensible** —sensibilidad externa e interna— y **conocimiento intelectual** —simple aprehensión, juicio y razonamiento—.",
  },
  {
    chapterId: "tema-4",
    section: "3.1 · El conocimiento sensible",
    question: "¿Qué diferencia hay entre sensibilidad externa e interna?",
    answer:
      "La **sensibilidad externa** comienza cuando los órganos sensoriales son afectados por un estímulo y producen una sensación. La **sensibilidad interna** unifica, conserva, recuerda y valora lo percibido.",
  },
  {
    chapterId: "tema-4",
    section: "3.1 · El conocimiento sensible",
    question: "¿Qué facultades forman la sensibilidad interna?",
    answer: "El **sensorio común**, la **imaginación**, la **memoria** y la **estimativa**.",
  },
  {
    chapterId: "tema-4",
    section: "3.1 · El conocimiento sensible",
    question: "¿Qué hacen el sensorio común y la imaginación?",
    answer:
      "- El **sensorio común** unifica la información de los sentidos y hace posible la percepción del objeto.\n- La **imaginación** vuelve a hacer presente el objeto ausente, agrupa percepciones y configura una imagen.",
  },
  {
    chapterId: "tema-4",
    section: "3.1 · El conocimiento sensible",
    question: "¿Qué hacen la memoria y la estimativa?",
    answer:
      "- La **memoria** archiva y reproduce lo percibido en sus circunstancias de lugar y tiempo, dando continuidad a la intimidad subjetiva.\n- La **estimativa** valora la utilidad, conveniencia o inconveniencia de lo percibido para el organismo.",
  },
  {
    chapterId: "tema-4",
    section: "5.1 · El giro gnoseológico",
    question: "¿Cuáles son las dos preguntas centrales del giro gnoseológico?",
    answer:
      "- La pregunta por el **origen**: si el conocimiento sensible es la única fuente del conocimiento.\n- La pregunta sobre su **alcance**: si conocemos las cosas en sí mismas o solo nuestras ideas o representaciones.",
  },
  {
    chapterId: "tema-4",
    section: "5.2 · ¿Qué es la verdad?",
    question: "¿Cuáles son los tres sentidos de verdad que presenta el libro?",
    answer:
      "La verdad como **adecuación del entendimiento con la cosa**, la **verdad lógica** y la **verdad ontológica**.",
  },
  {
    chapterId: "tema-4",
    section: "5.3 · Estados de la mente",
    question: "¿Cuáles son los estados de la mente ante la verdad?",
    answer: "La **certeza**, la **duda**, la **opinión**, la **fe**, la **ignorancia** y el **error**.",
  },
  {
    chapterId: "tema-4",
    section: "5.4 · Posverdad",
    question: "¿Qué tres rasgos ayudan a entender la posverdad?",
    answer:
      "Opera en el campo de la **opinión pública**; no se identifica con la mentira ni con el error, sino con una mala praxis que antepone prejuicios a la realidad; y cobra entidad en la sociedad actual.",
  },
  {
    chapterId: "tema-4",
    section: "5.4 · Posverdad",
    question: "¿Qué factores explican la irrupción de la posverdad?",
    answer:
      "El **relativismo**, el **emotivismo epistemológico** y la **ideologización del discurso público**.",
  },
  {
    chapterId: "tema-4",
    section: "5.4 · Posverdad",
    question: "¿Qué efectos produce la posverdad?",
    answer:
      "En el individuo impide formarse una opinión ajustada y objetiva y obstaculiza la verdad. Socialmente acentúa la polarización y la conflictividad, dificulta la participación y el encuentro necesarios para buscar el bien común.",
  },
  {
    chapterId: "tema-4",
    section: "5.4 · Posverdad",
    question: "¿Cómo conviene actuar ante la información difundida por nuevas tecnologías?",
    answer:
      "Consultar **fuentes fiables**, **contrastar la información** y vencer los sesgos que nos inclinan a interpretar la realidad desde la ideología en lugar de la razón.",
  },

  {
    chapterId: "tema-7",
    section: "1.1 · La metafísica en la vida humana",
    question: "¿Por qué la metafísica es una actitud natural?",
    answer:
      "Porque está presente en todo ser humano: surge inevitablemente la pregunta por la causa y el sentido de la existencia o, como formuló Leibniz, **«¿por qué el ser y no, más bien, la nada?»**.",
  },
  {
    chapterId: "tema-7",
    section: "1.1 · La metafísica en la vida humana",
    question: "¿Qué aporta la metafísica a la vida humana?",
    answer:
      "Abre las puertas de la auténtica sabiduría: proporciona una visión crítica para analizar otros saberes y fundamenta la vida moral, permitiendo ordenar las acciones hacia el fin de la existencia.",
  },
  {
    chapterId: "tema-7",
    section: "1.2 · La metafísica en la filosofía",
    question: "¿Cuál es la cuestión más radical de la metafísica?",
    answer: "**¿Qué es la realidad?**",
  },
  {
    chapterId: "tema-7",
    section: "1.3 · La metafísica entre las ciencias",
    question: "¿Cuál es la definición completa de metafísica?",
    answer:
      "La metafísica es la ciencia que estudia **el ente en cuanto ente, sus propiedades y sus causas últimas**.",
  },
  {
    chapterId: "tema-7",
    section: "1.3 · Primeros principios",
    question: "¿Qué propiedades tiene el principio de no contradicción?",
    answer:
      "Se presenta inmediatamente a la inteligencia, es **evidente por sí mismo**, **universal** y **necesario**. Es el primer principio de la realidad y del conocimiento.",
  },
  {
    chapterId: "tema-7",
    section: "1.3 · Primeros principios",
    question: "¿Cuáles son los cuatro primeros principios de la metafísica?",
    answer:
      "El principio de **no contradicción**, el de **identidad**, el de **tercero excluido** y el de **causalidad**.",
  },
  {
    chapterId: "tema-7",
    section: "2.2 · Acto, potencia y cambio",
    question: "¿Qué es el cambio?",
    answer:
      "El paso de lo que es en **potencia** a lo que es en **acto**: la actualización de una potencia previa, por la que un sujeto adquiere en acto una perfección que solo poseía en potencia.",
  },
  {
    chapterId: "tema-7",
    section: "2.3 · Sustancia y accidentes",
    question: "¿Qué son la sustancia y los accidentes?",
    answer:
      "- La **sustancia** es el núcleo de una cosa, gracias al cual es algo unitario y una realidad en sí. Responde a «¿qué es esto?».\n- Los **accidentes** son cualidades o propiedades cuya realidad consiste en ser en otro y que dependen de la sustancia.",
  },
  {
    chapterId: "tema-7",
    section: "2.3 · Sustancia y accidentes",
    question: "¿Cómo conocemos la sustancia?",
    answer:
      "A través de los accidentes. La inteligencia accede a la sustancia gracias al conocimiento sensible, mediante el cual capta sus propiedades.",
  },
  {
    chapterId: "tema-7",
    section: "2.3 · Sustancia y accidentes",
    question: "¿Qué diferencia hay entre cambio accidental y cambio sustancial?",
    answer:
      "- El **cambio accidental** afecta a los accidentes y mantiene la sustancia.\n- En el **cambio sustancial**, una sustancia se transforma en otra diferente.",
  },
  {
    chapterId: "tema-7",
    section: "2.4 · Esencia y acto de ser",
    question: "¿Qué son la esencia y el acto de ser?",
    answer:
      "- La **esencia** hace que algo sea lo que es y determina su modo de ser; se llama naturaleza cuando determina su manera de obrar.\n- El **acto de ser** es la perfección común a todos los entes y el fundamento último de su realidad.",
  },
  {
    chapterId: "tema-7",
    section: "2.4 · Esencia y acto de ser",
    question: "¿Qué se concluye al distinguir esencia y acto de ser?",
    answer:
      "Que el ente no posee el ser en plenitud ni en propiedad. De su finitud se desprenden los **grados de ser** y la **participación en el ser**.",
  },
  {
    chapterId: "tema-7",
    section: "2.5 · Entes materiales",
    question: "¿Qué principios componen la esencia de los entes materiales?",
    answer: "La **materia prima** y la **forma sustancial**.",
  },
  {
    chapterId: "tema-7",
    section: "2.5 · Entes materiales",
    question: "¿Qué son la materia prima y la forma sustancial?",
    answer:
      "- La **materia prima** es el sustrato que permanece en todo cambio sustancial; es potencia pura e indeterminada.\n- La **forma sustancial** es el principio por el que el ente es de un modo determinado; unifica y organiza sus componentes.",
  },
  {
    chapterId: "tema-7",
    section: "2.6 · Causalidad · Solo interrogante",
    question: "¿Qué cuatro preguntas permiten identificar las cuatro causas de una realidad?",
    answer:
      "- **¿De qué está hecha?** — causa material.\n- **¿Qué es?** — causa formal.\n- **¿Quién o qué la produce?** — causa eficiente.\n- **¿Para qué?** — causa final.",
  },
  {
    chapterId: "tema-7",
    section: "2.7 · Los trascendentales",
    question: "¿Qué son los trascendentales y cuáles presenta el libro?",
    answer:
      "Son atributos o propiedades que se predican de toda realidad porque trascienden las determinaciones particulares: la **unidad**, la **verdad** y el **bien**.",
  },
  {
    chapterId: "tema-7",
    section: "2.7 · Los trascendentales",
    question: "¿Qué es la unidad como trascendental?",
    answer:
      "Cada ente es uno en la medida en que se distingue de otro ente y es indivisible, es decir, no está dividido interiormente.",
  },
  {
    chapterId: "tema-7",
    section: "2.7 · Los trascendentales",
    question: "¿Qué es la verdad como trascendental?",
    answer:
      "Todo ente es verdadero en cuanto puede ser conocido. El conocimiento es verdadero si se funda en lo que las cosas son.",
  },
  {
    chapterId: "tema-7",
    section: "2.7 · Los trascendentales",
    question: "¿Qué es el bien como trascendental?",
    answer:
      "Todo ente, por el mero hecho de ser, presenta alguna perfección; por ella lo queremos o deseamos. Su bondad depende de su grado de ser.",
  },
  {
    chapterId: "tema-7",
    section: "3 · La pregunta sobre Dios",
    question: "¿Qué es la teodicea?",
    answer:
      "La parte de la metafísica que se interroga por la **Causa primera** y el último fundamento de la realidad.",
  },
  {
    chapterId: "tema-7",
    section: "3.1 · La existencia de Dios",
    question: "¿Qué diferencia hay entre argumentos a simultaneo y a posteriori?",
    answer:
      "- Los argumentos **a simultaneo** son deductivos e infieren propiedades desde la esencia de una realidad.\n- Los argumentos **a posteriori** son inductivos y ascienden desde los efectos observados a su causa.",
  },
  {
    chapterId: "tema-7",
    section: "3.1 · La existencia de Dios",
    question: "¿Qué diferencia hay entre pruebas cosmológicas y teleológicas?",
    answer:
      "- Las **cosmológicas** parten de los entes finitos para concluir en una Causa primera.\n- Las **teleológicas** parten del orden y la armonía del mundo para concluir en una inteligencia ordenadora suprema.",
  },
  {
    chapterId: "tema-7",
    section: "3.1 · Las cinco vías",
    question: "¿Qué estructura comparten las cinco vías de santo Tomás?",
    answer:
      "Parten de un hecho observado; aplican el principio de causalidad; niegan un proceso al infinito en causas subordinadas; y concluyen en una **Causa primera** llamada Dios.",
  },
  {
    chapterId: "tema-7",
    section: "3.1 · Las cinco vías",
    question: "¿Cuáles son las cinco vías para demostrar la existencia de Dios?",
    answer:
      "La vía del **movimiento**, de la **causalidad eficiente**, de la **contingencia**, de la **participación de las perfecciones** y de la **finalidad**.",
  },
  {
    chapterId: "tema-7",
    section: "3.2 · Exclusión de la pregunta sobre Dios",
    question: "¿Qué diferencia hay entre agnosticismo y ateísmo?",
    answer:
      "El **agnosticismo** no niega ni afirma la existencia de Dios, sino que sostiene que la razón no puede demostrarla. El **ateísmo** niega su existencia y, en autores como Marx y Nietzsche, la considera incompatible con la plena autonomía humana.",
  },
  {
    chapterId: "tema-7",
    section: "3.3 · Importancia de la pregunta sobre Dios",
    question: "¿Por qué es primordial la pregunta sobre Dios?",
    answer:
      "Porque sin Dios se plantea en qué fundamentar la dignidad humana. El ser humano pregunta por las causas y fines últimos de la realidad y de su existencia; la teodicea busca el fundamento con fuerza propia para sostener cualquier otra realidad.",
  },

  {
    chapterId: "tema-8",
    section: "1.1 · La ética como filosofía práctica",
    question: "¿Qué es la ética?",
    answer:
      "La disciplina filosófica que reflexiona sobre la **acción humana** en la medida en que es **libre** y pretende ser guiada por el **bien**.",
  },
  {
    chapterId: "tema-8",
    section: "1.1 · La ética como filosofía práctica",
    question: "¿Qué características tiene la ética?",
    answer:
      "Es un saber **práctico**, orientado a la acción; **directivo**, porque ofrece criterios para guiarla; y reflexiona sobre la **acción libre** de la persona.",
  },
  {
    chapterId: "tema-8",
    section: "1.1 · Razón práctica y técnica",
    question: "¿Qué diferencia hay entre razón práctica y razón técnica?",
    answer:
      "La razón práctica juzga lo bueno y orienta la acción libre. La **razón técnica** está presente al producir cosas o buscar utilidad: lo determinante es escoger los medios más convenientes para el fin propuesto.",
  },
  {
    chapterId: "tema-8",
    section: "1.2 · El bien y el fin último",
    question: "¿Qué es la felicidad para la ética?",
    answer:
      "El fin último del ser humano: se desea por sí misma y es el bien en función del cual se ordenan y clasifican los restantes bienes o fines concretos de la vida.",
  },
  {
    chapterId: "tema-8",
    section: "1.2 · El bien y el fin último",
    question: "¿Qué características debe tener el bien último del que depende la felicidad?",
    answer:
      "Debe ser **completo**, capaz de colmar todas las aspiraciones; **duradero**, no dependiente de las circunstancias; y **auténtico**, de modo que excluya todo mal.",
  },
  {
    chapterId: "tema-8",
    section: "1.2 · Las modalidades de bien",
    question: "¿Cuáles son las tres modalidades de bien?",
    answer: "El bien **útil**, el bien **deleitable** y el bien **honesto**.",
  },
  {
    chapterId: "tema-8",
    section: "1.2 · Las modalidades de bien",
    question: "¿Qué es el bien útil?",
    answer:
      "La bondad que atribuimos a las acciones o cosas que sirven para obtener un fin determinado de un modo eficaz.",
  },
  {
    chapterId: "tema-8",
    section: "1.2 · Las modalidades de bien",
    question: "¿Qué es el bien deleitable?",
    answer:
      "La bondad de lo que se quiere porque causa en el sujeto una resonancia afectiva positiva: placer, satisfacción, alegría, etc.",
  },
  {
    chapterId: "tema-8",
    section: "1.2 · Las modalidades de bien",
    question: "¿Qué es el bien honesto?",
    answer:
      "La bondad de las acciones o cosas buscadas por sí mismas porque son objetivamente buenas y dignas de ser amadas, con independencia de sus repercusiones afectivas.",
  },
  {
    chapterId: "tema-8",
    section: "2.1 · El orden moral",
    question: "¿Qué es la recta razón?",
    answer:
      "La razón práctica que comprende sin error los fines que convienen al ser humano y, por ello, puede ser norma de la acción moral.",
  },
  {
    chapterId: "tema-8",
    section: "2.1 · El orden moral",
    question: "¿Qué es la ley moral natural?",
    answer:
      "Los principios o criterios adecuados al modo de ser de la persona que permiten distinguir objetivamente las acciones que contribuyen a su perfeccionamiento de las que lo dificultan.",
  },
  {
    chapterId: "tema-8",
    section: "2.1 · El orden moral",
    question: "¿Qué es la conciencia moral?",
    answer:
      "La capacidad interior que permite ajustar las acciones y decisiones concretas a las exigencias y criterios de la ley moral natural, sin someterlas al simple interés.",
  },
  {
    chapterId: "tema-8",
    section: "2.2 · Principios de la razón práctica",
    question: "¿Qué dimensiones originan las inclinaciones naturales del ser humano?",
    answer:
      "Sus dimensiones de ser **viviente**, **animal** y **racional y libre**. Son inclinaciones, no instintos determinantes, y están sujetas al ejercicio de la razón.",
  },
  {
    chapterId: "tema-8",
    section: "3 · Principales concepciones éticas",
    question: "¿Cómo distingue el libro entre éticas eudemonistas y no eudemonistas?",
    answer:
      "Las **eudemonistas** relacionan la acción con el bien —útil, deleitable u honesto—. Las **no eudemonistas** ponen el criterio de la acción en el cumplimiento del deber o en el acuerdo fruto del diálogo.",
  },
  {
    chapterId: "tema-8",
    section: "4 · El sujeto moral",
    question: "¿Quién es el sujeto moral?",
    answer:
      "La **persona**, como ser libre y responsable. Sin capacidad para orientar la propia conducta no podría hablarse de acciones morales o inmorales.",
  },
  {
    chapterId: "tema-8",
    section: "4.1 · Autorrealización y virtud",
    question: "¿Qué es un hábito?",
    answer:
      "Una disposición permanente adquirida por la repetición de actos que hace posible que la persona actúe de un modo determinado y desarrolle su modo de ser.",
  },
  {
    chapterId: "tema-8",
    section: "4.1 · Autorrealización y virtud",
    question: "¿Qué diferencia hay entre virtud y vicio?",
    answer:
      "Las **virtudes** son hábitos que facilitan la elección de valores auténticos. Los **vicios** son hábitos que orientan hacia valores aparentes o antivalores.",
  },
  {
    chapterId: "tema-8",
    section: "4.1 · La acción moral y la afectividad",
    question: "¿Qué son las pasiones en ética?",
    answer:
      "Los sentimientos, emociones, estados anímicos y afectos, considerados en su carácter sensible y en su influencia sobre la razón y la voluntad.",
  },
  {
    chapterId: "tema-8",
    section: "4.1 · La acción moral y la afectividad",
    question: "¿Cómo se integran las pasiones en la acción moral?",
    answer:
      "Descubriendo su sentido; juzgando si se orientan al bien de la persona; y aceptando, corrigiendo, rechazando o suscitando el sentimiento ya valorado para armonizarlo con el juicio de la razón.",
  },
  {
    chapterId: "tema-8",
    section: "4.2 · La persona libre y responsable",
    question: "¿Qué tres elementos intervienen en el juicio moral?",
    answer: "El **objeto**, la **intención** y las **circunstancias**.",
  },
  {
    chapterId: "tema-8",
    section: "4.2 · El juicio moral",
    question: "¿Qué es el objeto de una acción moral?",
    answer:
      "El fin que especifica la acción desde el punto de vista moral. Es un elemento decisivo para determinar su bondad o maldad.",
  },
  {
    chapterId: "tema-8",
    section: "4.2 · El juicio moral",
    question: "¿Qué es la intención en una acción moral?",
    answer:
      "El fin que ha tenido el agente al realizar la acción. Un acto moralmente bueno debe unir a un buen objeto una buena intención.",
  },
  {
    chapterId: "tema-8",
    section: "4.2 · El juicio moral",
    question: "¿Qué son las circunstancias de una acción moral?",
    answer:
      "Los elementos concretos que acompañan o rodean la acción —cantidad, modo, lugar, tiempo, etc.— y que pueden aumentar o disminuir su gravedad o mérito.",
  },
  {
    chapterId: "tema-8",
    section: "4.2 · Fin y medios",
    question: "¿Justifica el fin los medios?",
    answer:
      "No. Si los medios son moralmente malos, la bondad del fin no los justifica ni los convierte en buenos.",
  },
  {
    chapterId: "tema-8",
    section: "4.2 · Fin y consecuencias",
    question: "¿Qué diferencia hay entre fines y consecuencias?",
    answer:
      "Los **fines** están en la persona antes de empezar a obrar; las **consecuencias** suceden temporalmente después de la acción.",
  },
  {
    chapterId: "tema-8",
    section: "4.2 · Responsabilidad",
    question: "¿Cómo influyen las consecuencias en la responsabilidad?",
    answer:
      "La responsabilidad por una acción u omisión aumenta con las consecuencias previsibles que el agente debía considerar.",
  },
  {
    chapterId: "tema-8",
    section: "5.1 · Nuevos riesgos",
    question: "¿Qué nuevos riesgos de la sociedad actual señala el libro?",
    answer:
      "La **interdependencia y complejidad**, las **sociedades de riesgo** y la **sociedad de consumo**, junto con sus efectos tecnológicos, culturales, sociales y medioambientales.",
  },
  {
    chapterId: "tema-8",
    section: "5.1 · Interdependencia y complejidad",
    question: "¿Qué significan la interdependencia y la complejidad actuales?",
    answer:
      "Que las diversas áreas de la actividad humana están conectadas y apenas existen sectores sociales aislados. El desarrollo tecnológico elimina barreras y, al aplicarse a la medicina, la inteligencia artificial o el ocio, plantea nuevos retos.",
  },
  {
    chapterId: "tema-8",
    section: "5.1 · Sociedades de riesgo",
    question: "¿Qué riesgos aparecen en las sociedades globalizadas?",
    answer:
      "Junto a la riqueza del pluralismo social y cultural surgen posturas intolerantes o relativistas; además, la crisis del estado del bienestar y la separación de los espacios familiar y laboral erosionan el «mundo de la vida».",
  },
  {
    chapterId: "tema-8",
    section: "5.1 · Sociedad de consumo",
    question: "¿Qué problemas genera la sociedad de consumo?",
    answer:
      "Difunde un modelo hedonista centrado en satisfacer deseos, merma la capacidad de vivir en común y compartir, e impulsa una industrialización masiva que amenaza el medio ambiente y la diversidad de especies.",
  },
];

const bookCards: PhilosophyCard[] = BOOK_CARD_SEEDS.map((seed, index) => {
  const chapter = chapterById.get(seed.chapterId);
  if (!chapter) {
    throw new Error(`Unknown philosophy chapter: ${seed.chapterId}`);
  }

  return {
    id: `book-${seed.chapterId}-${index + 1}`,
    chapterId: seed.chapterId,
    chapterTitle: `${chapter.shortTitle} · ${chapter.title}`,
    section: seed.section,
    question: seed.question,
    answer: seed.answer,
    source: "book",
  };
});

const ankiCards: PhilosophyCard[] = PHILOSOPHY_ANKI_SEEDS.map((seed) => {
  const chapter = chapterById.get(seed.chapterId);
  if (!chapter) {
    throw new Error(`Unknown philosophy chapter: ${seed.chapterId}`);
  }

  return {
    id: `anki-${seed.ankiId}`,
    chapterId: seed.chapterId,
    chapterTitle: `${chapter.shortTitle} · ${chapter.title}`,
    section: "Tarjeta original del mazo de Anki",
    question: seed.question,
    answer: seed.answer,
    source: "anki",
    ankiId: seed.ankiId,
  };
});

export const PHILOSOPHY_CARDS: PhilosophyCard[] = [...ankiCards, ...bookCards];
