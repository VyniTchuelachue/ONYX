import type { CanDrive, IssueCategory, Locale, UrgencyLevel } from '../constants';

/**
 * Offline triage rules. Used when the device is offline, when no AI key is configured,
 * or when the AI call fails. Every check here must be safe for someone with no mechanical
 * training, standing by a road, possibly at night.
 */

interface RuleContent {
  reply: string;
  safety: string[];
  checks: { title: string; detail: string }[];
  causes: string[];
  followUp: string | null;
  quickReplies: string[];
  summary: string;
}

export interface TriageRule {
  category: IssueCategory;
  urgency: UrgencyLevel;
  canDrive: CanDrive;
  callEmergency: boolean;
  /** Higher wins when several rules match equally (safety-critical first). */
  priority: number;
  /** Lowercase, accent-free fragments. Multi-word fragments count double. */
  keywords: string[];
  content: Record<Locale, RuleContent>;
}

const HAZARD_FR = 'Allumez les feux de détresse et placez le triangle à environ 30 m derrière le véhicule (plus loin sur route rapide).';
const HAZARD_EN = 'Switch on your hazard lights and place the warning triangle about 30 m behind the vehicle (further on fast roads).';
const STAND_CLEAR_FR = 'Faites sortir les passagers du côté opposé à la circulation et attendez hors de la chaussée.';
const STAND_CLEAR_EN = 'Get passengers out on the side away from traffic and wait off the road.';

export const TRIAGE_RULES: TriageRule[] = [
  {
    category: 'smoke_fire',
    urgency: 'critical',
    canDrive: 'no',
    callEmergency: true,
    priority: 100,
    keywords: [
      'fumee', 'fume', 'feu', 'flamme', 'brule', 'incendie', 'odeur de brule', 'ca brule',
      'smoke', 'smoking', 'fire', 'flame', 'burning', 'burnt smell', 'burning smell',
    ],
    content: {
      fr: {
        reply: "Votre sécurité d'abord : arrêtez-vous, coupez le moteur et éloignez-vous du véhicule.",
        safety: [
          'Arrêtez-vous dès que possible, coupez le contact et allumez les feux de détresse.',
          "Faites sortir tout le monde et éloignez-vous d'au moins 30 mètres, du côté opposé à la circulation.",
          "N'ouvrez pas le capot si vous voyez des flammes : l'air attise le feu.",
          'En cas de flammes, appelez les sapeurs-pompiers au 118.',
        ],
        checks: [
          {
            title: "Observez l'origine, à distance",
            detail:
              'Fumée blanche et odeur sucrée : souvent le refroidissement. Fumée noire ou odeur de plastique brûlé : électrique ou carburant. Ne touchez à rien.',
          },
          {
            title: 'Cherchez une fuite',
            detail: "Une flaque d'essence ou d'huile sous le véhicule augmente le risque d'incendie. Restez loin et ne fumez pas.",
          },
        ],
        causes: ['Liquide de refroidissement qui coule sur le moteur chaud', 'Court-circuit électrique', "Fuite d'huile ou de carburant"],
        followUp: 'Voyez-vous des flammes, ou seulement de la fumée ?',
        quickReplies: ['Il y a des flammes', 'Seulement de la fumée', 'La fumée a cessé'],
        summary: 'Fumée ou odeur de brûlé signalée. Véhicule arrêté, conducteur éloigné. Risque incendie à évaluer, remorquage probable.',
      },
      en: {
        reply: 'Your safety first: stop, switch off the engine and move away from the vehicle.',
        safety: [
          'Stop as soon as you safely can, switch off the ignition and turn on your hazard lights.',
          'Get everyone out and move at least 30 metres away, on the side away from traffic.',
          "Don't open the bonnet if you see flames: air feeds the fire.",
          'If there are flames, call the fire service on 118.',
        ],
        checks: [
          {
            title: 'Look for the source, from a distance',
            detail:
              'White smoke with a sweet smell is often coolant. Black smoke or a burnt-plastic smell points to wiring or fuel. Touch nothing.',
          },
          {
            title: 'Look for a leak',
            detail: 'Fuel or oil pooling under the vehicle raises the fire risk. Stay back and do not smoke.',
          },
        ],
        causes: ['Coolant leaking onto a hot engine', 'Electrical short circuit', 'Oil or fuel leak'],
        followUp: 'Can you see flames, or only smoke?',
        quickReplies: ['There are flames', 'Only smoke', 'The smoke has stopped'],
        summary: 'Smoke or burning smell reported. Vehicle stopped, driver standing clear. Fire risk to assess; towing likely.',
      },
    },
  },
  {
    category: 'accident',
    urgency: 'critical',
    canDrive: 'no',
    callEmergency: true,
    priority: 95,
    keywords: [
      'accident', 'collision', 'choc', 'accroche', 'tonneau', 'renverse', 'percute', 'blesse', 'cogne une',
      'crash', 'crashed', 'hit a', 'rolled', 'injured', 'hurt', 'collided',
    ],
    content: {
      fr: {
        reply: "Après un accident, mettez-vous d'abord en sécurité et vérifiez si quelqu'un est blessé.",
        safety: [
          HAZARD_FR,
          "Si quelqu'un est blessé, appelez le SAMU au 119 et ne le déplacez pas, sauf danger immédiat.",
          STAND_CLEAR_FR,
          'Appelez la police au 117 si la circulation est bloquée ou pour le constat.',
        ],
        checks: [
          {
            title: 'Repérez les fuites',
            detail: "Essence ou liquide sous la voiture : restez à distance et n'essayez pas de redémarrer.",
          },
          {
            title: 'Photographiez la scène',
            detail: "Si vous êtes en sécurité, prenez des photos des véhicules et des plaques pour l'assurance.",
          },
        ],
        causes: ['Dégâts possibles au radiateur, aux roues, à la direction ou à la suspension'],
        followUp: "Quelqu'un est-il blessé ?",
        quickReplies: ["Personne n'est blessé", 'Il y a un blessé', "J'ai besoin d'une dépanneuse"],
        summary: 'Accident signalé. Vérifier blessés et fuites avant intervention. Remorquage probablement nécessaire.',
      },
      en: {
        reply: 'After an accident, get to safety first and check whether anyone is hurt.',
        safety: [
          HAZARD_EN,
          "If anyone is injured, call the ambulance service (SAMU) on 119 and don't move them unless they're in immediate danger.",
          STAND_CLEAR_EN,
          'Call the police on 117 if traffic is blocked or you need an accident report.',
        ],
        checks: [
          {
            title: 'Look for leaks',
            detail: "Fuel or fluid under the car: stay back and don't try to restart the engine.",
          },
          {
            title: 'Photograph the scene',
            detail: 'If you are safe, take photos of the vehicles and number plates for insurance.',
          },
        ],
        causes: ['Possible damage to radiator, wheels, steering or suspension'],
        followUp: 'Is anyone injured?',
        quickReplies: ['Nobody is hurt', 'Someone is injured', 'I need a tow truck'],
        summary: 'Accident reported. Check for injuries and leaks before working on the vehicle. Towing probably needed.',
      },
    },
  },
  {
    category: 'brakes',
    urgency: 'high',
    canDrive: 'no',
    callEmergency: false,
    priority: 90,
    keywords: ['frein', 'freins', 'freinage', 'pedale molle', 'freine mal', 'brake', 'brakes', 'braking', 'soft pedal', 'spongy'],
    content: {
      fr: {
        reply: 'Un problème de freins est sérieux : ne reprenez pas la route avant une vérification.',
        safety: [
          "Si vous roulez encore : relâchez l'accélérateur, rétrogradez et serrez progressivement le frein à main pour vous arrêter sur le bas-côté.",
          HAZARD_FR,
        ],
        checks: [
          {
            title: 'Le voyant de frein',
            detail: 'Un voyant rouge de frein allumé signale un niveau de liquide bas ou un frein à main resté serré.',
          },
          {
            title: 'Regardez près des roues',
            detail: 'Une tache huileuse près d’une roue peut indiquer une fuite de liquide de frein.',
          },
          {
            title: 'Niveau du liquide',
            detail:
              'Moteur coupé, regardez le bocal de liquide de frein (souvent près du pare-brise, côté conducteur). Sous le repère MIN, ne roulez pas.',
          },
        ],
        causes: ['Fuite ou niveau bas de liquide de frein', 'Plaquettes usées', 'Air dans le circuit'],
        followUp: null,
        quickReplies: ['La pédale est molle', 'Ça grince fort', 'Le voyant est allumé'],
        summary: 'Problème de freinage signalé. Véhicule à ne pas déplacer par la route : contrôle sur place ou remorquage.',
      },
      en: {
        reply: "A brake problem is serious: don't drive on until it has been checked.",
        safety: [
          'If you are still moving: ease off the accelerator, shift down and apply the handbrake gradually to stop on the roadside.',
          HAZARD_EN,
        ],
        checks: [
          {
            title: 'The brake warning light',
            detail: 'A red brake light means low brake fluid or a handbrake left on.',
          },
          {
            title: 'Look near the wheels',
            detail: 'An oily patch near one wheel can mean a brake fluid leak.',
          },
          {
            title: 'Fluid level',
            detail:
              'With the engine off, look at the brake fluid reservoir (usually near the windscreen, driver side). Below MIN, do not drive.',
          },
        ],
        causes: ['Brake fluid leak or low level', 'Worn brake pads', 'Air in the brake lines'],
        followUp: null,
        quickReplies: ['The pedal feels soft', 'Loud grinding', 'The warning light is on'],
        summary: 'Braking problem reported. Vehicle should not be driven: on-site check or tow.',
      },
    },
  },
  {
    category: 'overheating',
    urgency: 'high',
    canDrive: 'no',
    callEmergency: false,
    priority: 80,
    keywords: [
      'chauffe', 'surchauffe', 'temperature', 'radiateur', 'vapeur', 'liquide de refroidissement', 'eau du moteur', 'thermostat',
      'overheat', 'overheating', 'radiator', 'steam', 'coolant', 'temperature gauge', 'running hot',
    ],
    content: {
      fr: {
        reply: "Le moteur chauffe : arrêtez-vous et coupez le moteur pour éviter de l'abîmer.",
        safety: [
          'Garez-vous en sécurité, coupez le moteur et allumez les feux de détresse.',
          "N'ouvrez jamais le bouchon du radiateur ou du vase d'expansion moteur chaud : le liquide brûlant peut jaillir.",
        ],
        checks: [
          {
            title: 'Laissez refroidir 30 minutes',
            detail: "N'ouvrez le capot que s'il ne sort plus de vapeur, et attendez avant tout contrôle.",
          },
          {
            title: 'Cherchez une fuite',
            detail: "Une flaque verte, rose ou bleue sous l'avant indique une fuite de liquide de refroidissement.",
          },
          {
            title: 'Niveau, moteur froid',
            detail: "Moteur froid, regardez le vase d'expansion : sous le repère MIN, il manque du liquide.",
          },
          {
            title: 'Le ventilateur',
            detail: "Moteur froid et contact coupé, vérifiez que rien ne bloque le ventilateur. N'approchez jamais les mains moteur tournant.",
          },
        ],
        causes: ['Manque de liquide de refroidissement', 'Fuite au radiateur ou à une durite', 'Ventilateur ou thermostat défaillant'],
        followUp: null,
        quickReplies: ['Il y a de la vapeur', 'Je vois une fuite', "L'aiguille est dans le rouge"],
        summary: 'Surchauffe moteur signalée. Moteur coupé. Vérifier niveau et fuite du circuit de refroidissement, ventilateur, thermostat.',
      },
      en: {
        reply: 'The engine is overheating: stop and switch it off to avoid damage.',
        safety: [
          'Park somewhere safe, switch off the engine and turn on your hazard lights.',
          'Never open the radiator or expansion tank cap while the engine is hot: scalding coolant can spray out.',
        ],
        checks: [
          {
            title: 'Let it cool for 30 minutes',
            detail: 'Only open the bonnet once no more steam is coming out, and wait before checking anything.',
          },
          {
            title: 'Look for a leak',
            detail: 'A green, pink or blue puddle under the front means a coolant leak.',
          },
          {
            title: 'Level, engine cold',
            detail: 'With the engine cold, look at the expansion tank: below MIN, coolant is missing.',
          },
          {
            title: 'The fan',
            detail: 'Engine cold and ignition off, check nothing is blocking the fan. Never put your hands near it with the engine running.',
          },
        ],
        causes: ['Low coolant', 'Radiator or hose leak', 'Faulty fan or thermostat'],
        followUp: null,
        quickReplies: ['There is steam', 'I can see a leak', 'The gauge is in the red'],
        summary: 'Engine overheating reported. Engine off. Check coolant level and leaks, fan and thermostat.',
      },
    },
  },
  {
    category: 'flat_tire',
    urgency: 'medium',
    canDrive: 'caution',
    callEmergency: false,
    priority: 60,
    keywords: [
      'pneu', 'crevaison', 'creve', 'roue', 'jante', 'eclate', 'degonfle', 'vulcan',
      'tire', 'tyre', 'flat', 'puncture', 'wheel', 'burst', 'blowout',
    ],
    content: {
      fr: {
        reply: "Un pneu crevé se règle vite. Mettez-vous d'abord à l'abri de la circulation.",
        safety: [
          'Roulez très lentement jusqu’à un endroit plat et sûr, loin de la chaussée.',
          HAZARD_FR,
          STAND_CLEAR_FR,
        ],
        checks: [
          {
            title: 'Roue de secours',
            detail: 'Vérifiez que vous avez une roue de secours gonflée, un cric et une clé à roue (souvent sous le plancher du coffre).',
          },
          {
            title: 'Le terrain',
            detail: 'Ne changez la roue que sur un sol plat et dur, jamais sur un bas-côté meuble ou en pente.',
          },
          {
            title: 'Si vous changez la roue',
            detail: 'Desserrez les écrous avant de lever la voiture, et ne passez jamais sous un véhicule tenu par le cric.',
          },
        ],
        causes: ['Clou ou objet tranchant', 'Valve défectueuse', 'Choc contre un nid-de-poule'],
        followUp: null,
        quickReplies: ["Je n'ai pas de roue de secours", 'Je veux un vulcanisateur', 'Le pneu a éclaté'],
        summary: 'Crevaison signalée. Réparation ou remplacement de pneu sur place.',
      },
      en: {
        reply: 'A flat tyre is quick to fix. First get yourself away from traffic.',
        safety: ['Drive very slowly to a flat, safe spot away from the road.', HAZARD_EN, STAND_CLEAR_EN],
        checks: [
          {
            title: 'Spare wheel',
            detail: 'Check you have an inflated spare, a jack and a wheel brace (often under the boot floor).',
          },
          {
            title: 'The ground',
            detail: 'Only change a wheel on flat, firm ground, never on a soft or sloping verge.',
          },
          {
            title: 'If you change the wheel',
            detail: 'Loosen the nuts before lifting the car, and never put any part of your body under a car held by a jack.',
          },
        ],
        causes: ['Nail or sharp object', 'Faulty valve', 'Pothole impact'],
        followUp: null,
        quickReplies: ["I don't have a spare", 'I need a tyre repairer', 'The tyre burst'],
        summary: 'Flat tyre reported. Tyre repair or replacement on site.',
      },
    },
  },
  {
    category: 'battery',
    urgency: 'medium',
    canDrive: 'unknown',
    callEmergency: false,
    priority: 50,
    keywords: [
      'batterie', 'cosse', 'clic', 'cables de demarrage', 'booster', 'decharge',
      'battery', 'terminal', 'jump start', 'jumper', 'clicking', 'flat battery', 'dead battery',
    ],
    content: {
      fr: {
        reply: 'Cela ressemble à un problème de batterie. Quelques vérifications simples peuvent aider.',
        safety: [
          'Si vous êtes sur la chaussée, allumez les feux de détresse (s’ils fonctionnent) et placez le triangle.',
          "N'essayez pas de démarrer avec des câbles si la batterie est fissurée, gonflée ou fuit.",
        ],
        checks: [
          {
            title: 'Le tableau de bord',
            detail: 'Contact mis, les voyants s’allument-ils faiblement ou pas du tout ? Une lumière faible indique une batterie déchargée.',
          },
          {
            title: 'Les cosses',
            detail:
              'Moteur coupé, regardez si les cosses sont desserrées ou couvertes d’un dépôt blanc ou vert. Ne posez jamais un outil métallique sur les deux bornes à la fois.',
          },
          {
            title: 'Démarrage avec des câbles',
            detail:
              'Si quelqu’un peut vous aider : câble rouge sur le + des deux batteries, câble noir sur le − de la batterie qui aide puis sur une partie métallique nue du moteur en panne.',
          },
        ],
        causes: ['Batterie déchargée (phares restés allumés, batterie ancienne)', 'Cosses desserrées ou oxydées', 'Alternateur qui ne charge plus'],
        followUp: null,
        quickReplies: ["J'entends des clics", "Rien ne s'allume", "J'ai des câbles"],
        summary: 'Batterie probablement déchargée. Prévoir test batterie et alternateur, booster ou batterie de remplacement.',
      },
      en: {
        reply: 'This sounds like a battery problem. A few simple checks can help.',
        safety: [
          'If you are on the road, turn on your hazard lights (if they work) and place the warning triangle.',
          "Don't jump-start if the battery is cracked, swollen or leaking.",
        ],
        checks: [
          {
            title: 'The dashboard',
            detail: 'With the ignition on, do the lights glow dimly or not at all? Dim lights mean a flat battery.',
          },
          {
            title: 'The terminals',
            detail: 'Engine off, check whether the terminals are loose or covered in white or green deposit. Never lay a metal tool across both terminals.',
          },
          {
            title: 'Jump-starting',
            detail:
              'If someone can help: red cable on the + of both batteries, black cable on the − of the good battery, then on bare metal on the broken-down engine.',
          },
        ],
        causes: ['Flat battery (lights left on, old battery)', 'Loose or corroded terminals', 'Alternator no longer charging'],
        followUp: null,
        quickReplies: ['I hear clicking', 'Nothing lights up', 'I have jumper cables'],
        summary: 'Likely flat battery. Bring a battery/alternator tester, booster or replacement battery.',
      },
    },
  },
  {
    category: 'wont_start',
    urgency: 'medium',
    canDrive: 'unknown',
    callEmergency: false,
    priority: 45,
    keywords: [
      'demarre pas', 'ne demarre', 'demarre plus', 'veut pas demarrer', 'cale', 'ne s allume', 'en panne',
      "won't start", 'wont start', "doesn't start", 'not starting', 'no start', 'stalled', 'cranks', 'broken down', 'broke down',
    ],
    content: {
      fr: {
        reply: 'Votre véhicule ne démarre pas. Voyons ce qui se passe quand vous tournez la clé.',
        safety: ['Si vous êtes arrêté sur la chaussée, allumez les feux de détresse et placez le triangle.'],
        checks: [
          {
            title: 'Écoutez au démarrage',
            detail:
              'Des clics rapides : batterie faible. Le moteur tourne sans démarrer : carburant ou allumage. Aucun bruit : batterie, démarreur ou antidémarrage.',
          },
          { title: 'La jauge de carburant', detail: 'Une jauge à zéro, ou une jauge en panne, est une cause fréquente.' },
          {
            title: 'Levier et embrayage',
            detail: 'En boîte automatique, mettez le levier sur P ou N. En manuelle, appuyez à fond sur l’embrayage.',
          },
          { title: 'Volant bloqué', detail: 'Si la clé ne tourne pas, tournez légèrement le volant en même temps que la clé.' },
        ],
        causes: ['Batterie faible', 'Panne de carburant', 'Démarreur ou allumage'],
        followUp: 'Que se passe-t-il quand vous tournez la clé : des clics, le moteur qui tourne, ou aucun bruit ?',
        quickReplies: ["J'entends des clics", 'Le moteur tourne sans démarrer', 'Aucun bruit'],
        summary: 'Véhicule qui ne démarre pas. Diagnostic démarrage : batterie, alimentation carburant, démarreur, antidémarrage.',
      },
      en: {
        reply: "Your vehicle won't start. Let's see what happens when you turn the key.",
        safety: ['If you are stopped on the road, turn on your hazard lights and place the warning triangle.'],
        checks: [
          {
            title: 'Listen when you start',
            detail:
              'Rapid clicking: weak battery. Engine turns but won’t fire: fuel or ignition. No sound at all: battery, starter motor or immobiliser.',
          },
          { title: 'The fuel gauge', detail: 'An empty tank, or a faulty gauge, is a common cause.' },
          {
            title: 'Gear lever and clutch',
            detail: 'With an automatic, put the lever in P or N. With a manual, press the clutch all the way down.',
          },
          { title: 'Locked steering', detail: "If the key won't turn, gently turn the steering wheel while turning the key." },
        ],
        causes: ['Weak battery', 'Out of fuel', 'Starter motor or ignition'],
        followUp: 'What happens when you turn the key: clicking, the engine turning over, or nothing at all?',
        quickReplies: ['I hear clicking', 'Engine turns but won’t start', 'No sound at all'],
        summary: 'Vehicle will not start. Starting diagnosis: battery, fuel supply, starter, immobiliser.',
      },
    },
  },
  {
    category: 'fuel',
    urgency: 'medium',
    canDrive: 'no',
    callEmergency: false,
    priority: 55,
    keywords: [
      'essence', 'carburant', 'gasoil', 'gazole', 'panne seche', 'reservoir', 'plus d essence', 'sent l essence',
      'fuel', 'petrol', 'diesel', 'empty tank', 'ran out', 'out of gas', 'smell of fuel', 'wrong fuel',
    ],
    content: {
      fr: {
        reply: "Panne de carburant ou fuite ? Si ça sent fort l'essence, éloignez-vous du véhicule.",
        safety: [
          "Si vous sentez une forte odeur d'essence ou voyez une fuite : coupez le moteur, ne fumez pas et éloignez-vous.",
          HAZARD_FR,
        ],
        checks: [
          {
            title: 'La jauge',
            detail: 'Une jauge proche de zéro indique une panne sèche. Un technicien peut apporter du carburant dans un bidon adapté.',
          },
          {
            title: 'Le bon carburant ?',
            detail: "Si vous venez de faire le plein, vérifiez qu'il s'agit du bon carburant. En cas d'erreur, ne redémarrez pas.",
          },
        ],
        causes: ['Réservoir vide', 'Erreur de carburant', "Fuite sur le circuit d'alimentation"],
        followUp: null,
        quickReplies: ['Je suis en panne sèche', "Ça sent l'essence", "J'ai mis le mauvais carburant"],
        summary: 'Problème de carburant (panne sèche, erreur ou fuite). Prévoir carburant en bidon ou vidange du réservoir.',
      },
      en: {
        reply: 'Out of fuel, or a leak? If there is a strong smell of fuel, move away from the vehicle.',
        safety: [
          'If you smell strong fuel or see a leak: switch off the engine, do not smoke, and move away.',
          HAZARD_EN,
        ],
        checks: [
          {
            title: 'The gauge',
            detail: 'A gauge near empty means you ran out. A technician can bring fuel in a proper container.',
          },
          {
            title: 'The right fuel?',
            detail: "If you just filled up, check it was the right fuel. If it wasn't, don't restart the engine.",
          },
        ],
        causes: ['Empty tank', 'Wrong fuel', 'Leak in the fuel line'],
        followUp: null,
        quickReplies: ['I ran out of fuel', 'It smells of fuel', 'I used the wrong fuel'],
        summary: 'Fuel problem (empty tank, wrong fuel or leak). Bring fuel in a container or drain the tank.',
      },
    },
  },
  {
    category: 'engine',
    urgency: 'medium',
    canDrive: 'caution',
    callEmergency: false,
    priority: 40,
    keywords: [
      'moteur', 'bruit', 'cogne', 'claque', 'puissance', 'huile', 'vibre', 'ralenti', 'tousse', 'broute',
      'engine', 'noise', 'knocking', 'power', 'oil', 'vibration', 'misfire', 'idle', 'sputter', 'jerks',
    ],
    content: {
      fr: {
        reply: 'Un bruit ou une perte de puissance du moteur mérite un contrôle rapide.',
        safety: ['Si le bruit est fort ou si un voyant rouge s’allume, arrêtez-vous en sécurité et coupez le moteur.', HAZARD_FR],
        checks: [
          { title: 'Les voyants', detail: 'Notez les voyants allumés : rouge, arrêt immédiat ; orange, contrôle bientôt.' },
          {
            title: "Le niveau d'huile",
            detail: 'Moteur coupé depuis 5 minutes et sur sol plat, sortez la jauge : le niveau doit être entre les deux repères.',
          },
          {
            title: "La fumée à l'échappement",
            detail: 'Bleue : huile. Blanche et épaisse : liquide de refroidissement. Noire : mélange trop riche.',
          },
        ],
        causes: ["Niveau d'huile bas", "Problème d'allumage ou d'injection", 'Courroie ou pièce mécanique usée'],
        followUp: 'Le bruit est-il plutôt un cognement, un sifflement ou un grincement ?',
        quickReplies: ['Ça cogne', 'Je perds de la puissance', 'Un voyant rouge est allumé'],
        summary: 'Bruit moteur ou perte de puissance. Contrôler huile, allumage, injection et courroies.',
      },
      en: {
        reply: 'A noise or loss of power from the engine is worth a quick check.',
        safety: ['If the noise is loud or a red warning light comes on, stop somewhere safe and switch off the engine.', HAZARD_EN],
        checks: [
          { title: 'Warning lights', detail: 'Note which lights are on: red means stop now; amber means get it checked soon.' },
          {
            title: 'Oil level',
            detail: 'Engine off for 5 minutes on level ground, pull the dipstick: the level should be between the two marks.',
          },
          {
            title: 'Exhaust smoke',
            detail: 'Blue: oil. Thick white: coolant. Black: running too rich.',
          },
        ],
        causes: ['Low oil level', 'Ignition or injection fault', 'Worn belt or mechanical part'],
        followUp: 'Is the noise more of a knock, a whistle or a grinding?',
        quickReplies: ["It's knocking", "I'm losing power", 'A red light is on'],
        summary: 'Engine noise or loss of power. Check oil, ignition, injection and belts.',
      },
    },
  },
  {
    category: 'electrical',
    urgency: 'low',
    canDrive: 'caution',
    callEmergency: false,
    priority: 30,
    keywords: [
      'phare', 'phares', 'electrique', 'fusible', 'essuie', 'vitre', 'klaxon', 'clignotant', 'tableau de bord eteint',
      'headlight', 'lights', 'electrical', 'fuse', 'wiper', 'window', 'horn', 'indicator', 'dashboard dead',
    ],
    content: {
      fr: {
        reply: 'Une panne électrique vient souvent d’un fusible ou d’un mauvais contact.',
        safety: ['De nuit et sans phares, ne roulez pas : garez-vous en sécurité avec les feux de détresse si possible.'],
        checks: [
          {
            title: 'Les fusibles',
            detail: "Le manuel indique la boîte à fusibles. Un fusible grillé a son filament coupé. Remplacez-le seulement par un fusible de même ampérage.",
          },
          {
            title: 'Plusieurs équipements à la fois ?',
            detail: "Si tout faiblit en même temps, la batterie ou l'alternateur est plus probable.",
          },
        ],
        causes: ['Fusible grillé', 'Ampoule ou connecteur défectueux', 'Alternateur faible'],
        followUp: 'Quel équipement ne fonctionne plus ?',
        quickReplies: ['Les phares ne marchent pas', "Le tableau de bord s'éteint", 'Les vitres ne marchent plus'],
        summary: 'Panne électrique. Contrôler fusibles, connecteurs, batterie et charge alternateur.',
      },
      en: {
        reply: 'An electrical fault often comes from a fuse or a bad connection.',
        safety: ["At night without headlights, don't drive: park somewhere safe with your hazard lights on if possible."],
        checks: [
          {
            title: 'Fuses',
            detail: 'The manual shows the fuse box. A blown fuse has a broken wire inside. Only replace it with one of the same rating.',
          },
          {
            title: 'Several things at once?',
            detail: 'If everything is getting weaker at the same time, the battery or alternator is more likely.',
          },
        ],
        causes: ['Blown fuse', 'Faulty bulb or connector', 'Weak alternator'],
        followUp: 'Which equipment has stopped working?',
        quickReplies: ["Headlights don't work", 'The dashboard keeps going off', "Windows don't work"],
        summary: 'Electrical fault. Check fuses, connectors, battery and alternator output.',
      },
    },
  },
  {
    category: 'clutch_gearbox',
    urgency: 'medium',
    canDrive: 'caution',
    callEmergency: false,
    priority: 35,
    keywords: [
      'embrayage', 'boite', 'vitesse', 'passe pas', 'patine', 'marche arriere',
      'clutch', 'gearbox', 'gear', 'transmission', 'slipping', 'reverse',
    ],
    content: {
      fr: {
        reply: "Un souci d'embrayage ou de boîte peut vite s'aggraver. Évitez de forcer.",
        safety: ['Si les vitesses ne passent plus, arrêtez-vous en sécurité plutôt que de rester sur la chaussée.', HAZARD_FR],
        checks: [
          { title: "La pédale d'embrayage", detail: 'Reste-t-elle au plancher, ou est-elle très dure ? Notez-le pour le technicien.' },
          { title: 'Une fuite ?', detail: "Regardez s'il y a une fuite d'huile sous le milieu du véhicule." },
        ],
        causes: ['Embrayage usé', "Fuite de liquide d'embrayage", 'Câble ou commande de boîte'],
        followUp: null,
        quickReplies: ['Les vitesses ne passent pas', "L'embrayage patine", 'La pédale reste au fond'],
        summary: "Problème d'embrayage ou de boîte de vitesses. Vérifier commande, liquide et usure.",
      },
      en: {
        reply: "A clutch or gearbox problem can get worse quickly. Don't force it.",
        safety: ["If you can't change gear, stop somewhere safe rather than staying on the road.", HAZARD_EN],
        checks: [
          { title: 'The clutch pedal', detail: 'Does it stay on the floor, or is it very stiff? Note it for the technician.' },
          { title: 'A leak?', detail: 'Look for oil dripping under the middle of the vehicle.' },
        ],
        causes: ['Worn clutch', 'Clutch fluid leak', 'Gear linkage or cable'],
        followUp: null,
        quickReplies: ["Gears won't engage", 'The clutch is slipping', 'The pedal stays down'],
        summary: 'Clutch or gearbox problem. Check linkage, fluid and wear.',
      },
    },
  },
  {
    category: 'warning_light',
    urgency: 'low',
    canDrive: 'caution',
    callEmergency: false,
    priority: 25,
    keywords: [
      'voyant', 'temoin', 'voyant moteur', 'voyant allume', 'voyant orange', 'voyant rouge', 'check engine',
      'lumiere orange', 'lumiere rouge', 'warning light', 'dashboard light', 'engine light',
    ],
    content: {
      fr: {
        reply: 'Un voyant allumé indique quoi vérifier. Sa couleur est la première information.',
        safety: ['Voyant rouge (huile, température, freins, batterie) : arrêtez-vous en sécurité et coupez le moteur.'],
        checks: [
          { title: 'La couleur', detail: 'Rouge : arrêt dès que possible. Orange : contrôle bientôt. Vert ou bleu : simple information.' },
          { title: 'Voyant moteur qui clignote', detail: 'Il signale un raté d’allumage : roulez le moins possible.' },
          { title: 'Une photo', detail: 'Photographiez le tableau de bord pour le montrer au technicien.' },
        ],
        causes: ['Capteur ou système antipollution', "Niveau ou pression d'huile", 'Charge de la batterie'],
        followUp: 'De quelle couleur est le voyant, et à quoi ressemble-t-il ?',
        quickReplies: ['Le voyant est rouge', 'Le voyant est orange', 'Il clignote'],
        summary: 'Voyant allumé au tableau de bord. Lecture des codes défaut (valise de diagnostic) recommandée.',
      },
      en: {
        reply: 'A warning light tells you what to check. Its colour is the first clue.',
        safety: ['Red light (oil, temperature, brakes, battery): stop somewhere safe and switch off the engine.'],
        checks: [
          { title: 'The colour', detail: 'Red: stop as soon as possible. Amber: get it checked soon. Green or blue: information only.' },
          { title: 'Flashing engine light', detail: 'It signals a misfire: drive as little as possible.' },
          { title: 'A photo', detail: 'Take a photo of the dashboard to show the technician.' },
        ],
        causes: ['Sensor or emissions system', 'Oil level or pressure', 'Battery charging'],
        followUp: 'What colour is the light, and what does it look like?',
        quickReplies: ['The light is red', 'The light is amber', "It's flashing"],
        summary: 'Dashboard warning light on. Fault-code reading (OBD scan) recommended.',
      },
    },
  },
  {
    category: 'other',
    urgency: 'low',
    canDrive: 'unknown',
    callEmergency: false,
    priority: 0,
    keywords: [],
    content: {
      fr: {
        reply: 'Décrivez ce que vous remarquez : un bruit, un voyant, une odeur, ou ce qui ne fonctionne plus.',
        safety: ['Si vous êtes à l’arrêt sur la chaussée : feux de détresse, triangle, et attendez hors du véhicule, du côté opposé à la circulation.'],
        checks: [],
        causes: [],
        followUp: 'Que se passe-t-il exactement quand vous essayez de démarrer ou de rouler ?',
        quickReplies: ['Ma voiture ne démarre pas', "J'ai un pneu crevé", 'Le moteur chauffe'],
        summary: 'Panne non précisée. Contacter le conducteur pour plus de détails.',
      },
      en: {
        reply: "Tell me what you notice: a noise, a warning light, a smell, or what has stopped working.",
        safety: ['If you are stopped on the road: hazard lights, warning triangle, and wait outside the vehicle on the side away from traffic.'],
        checks: [],
        causes: [],
        followUp: 'What exactly happens when you try to start or drive?',
        quickReplies: ["My car won't start", 'I have a flat tyre', 'The engine is overheating'],
        summary: 'Unspecified breakdown. Call the driver for details.',
      },
    },
  },
];
