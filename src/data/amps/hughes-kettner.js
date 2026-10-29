
/** @typedef {import("../../library/ampLibrary.js").AmpRecord} AmpRecord */

/** @type {AmpRecord[]} */
export const hugheskettnerAmps = [
  {
    id: "hughes-kettner-triamp",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "TriAmp",
    aliases: ["TriAmp MKI", "TriAmp MKII", "TriAmp MK3", "TriAmp Mark 3"],
    image: "triamp.png",
    description:
      "A flagship tube amplifier with six channels representing three distinct amplifier sections. Known for its broad tonal range, from classic clean sounds to modern high gain.",
    history:
      "The original TriAmp was introduced in 1995, combining several distinct tube-amp voicings in one amplifier. The MKII followed in 2002, and the TriAmp Mark 3 in 2015. The third generation has three independently usable power-amp sections and supports various combinations of power tubes.",
    introduced: 1995,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: "Up to 150 W",
    channels: 6,
    tubes: ["6L6", "EL34"],
    genres: ["Rock", "Hard Rock", "Metal", "Progressive Rock"],
    notableUsers: [],
    tags: ["flagship", "high-gain", "midi", "multi-channel", "versatile"]
  },
  {
    id: "hughes-kettner-coreblade",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "Coreblade",
    aliases: [],
    image: "coreblade.png",
    description:
      "A professional high-gain tube amplifier with four channels and storable sounds. Designed for modern rock and metal guitarists who need extensive programmability and reliable stage features.",
    history:
      "Introduced in 2009, the Coreblade continued Hughes & Kettner’s approach to programmable amplifiers. Sounds can be stored directly on the amp, while Tube Safety Control monitors the power tubes.",
    introduced: 2009,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: "100 W",
    channels: 4,
    tubes: [],
    genres: ["Hard Rock", "Heavy Metal", "Modern Metal"],
    notableUsers: [],
    tags: ["high-gain", "programmable", "midi", "modern-metal"]
  },
  {
    id: "hughes-kettner-switchblade-100",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "Switchblade 100",
    aliases: ["Switchblade 100 TSC"],
    image: "switchblade100.png",
    description:
      "A fully programmable 100-watt tube amplifier with four channels. It combines traditional tube-amp controls with storable settings and MIDI control.",
    history:
      "The Switchblade was released in 2006. Rather than storing only channel changes, it lets users recall control settings electronically, making it an important model in Hughes & Kettner’s history of programmable tube amplifiers.",
    introduced: 2006,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: "100 W",
    channels: 4,
    tubes: [],
    genres: ["Rock", "Hard Rock", "Metal"],
    notableUsers: [],
    tags: ["programmable", "midi", "multi-channel", "high-gain"]
  },
  {
    id: "hughes-kettner-duotone",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "Duotone",
    aliases: [],
    image: "duotone.png",
    description:
      "A classic-voiced all-tube amplifier from the Custom Tube series. It offers a clear clean sound and a powerful overdrive channel with an additional boost for rock rhythm and lead tones.",
    history:
      "The Duotone belongs to Hughes & Kettner’s Custom Tube series and uses a straightforward, classic control layout. Two footswitchable master volumes make it well suited to live performance.",
    introduced: null,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: "100 W",
    channels: 2,
    tubes: ["EL34"],
    genres: ["Classic Rock", "Hard Rock", "Blues Rock"],
    notableUsers: [],
    tags: ["classic-rock", "custom-tube", "boost", "live"]
  },
  {
    id: "hughes-kettner-grandmeister-deluxe-40",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "GrandMeister Deluxe 40",
    aliases: ["GrandMeister 40 Deluxe"],
    image: "grandmeister-deluxe-40.png",
    description:
      "A versatile 40-watt tube amplifier with four channels and extensive digital control. It combines clean, crunch, and lead sounds with storable settings and effects for stage and studio use.",
    history:
      "The GrandMeister Deluxe 40 belongs to Hughes & Kettner’s Deluxe generation, introduced in 2016. It brings the tonal range of the TriAmp concept to a compact format with recallable presets and extensive remote control.",
    introduced: 2016,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: "40 W",
    channels: 4,
    tubes: ["EL84"],
    genres: ["Pop Rock", "Classic Rock", "Hard Rock", "Modern Rock"],
    notableUsers: [],
    tags: ["midi", "programmable", "effects", "versatile", "studio", "live"]
  },
  {
    id: "hughes-kettner-tubemeister-deluxe-40",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "TubeMeister Deluxe 40",
    aliases: [],
    image: "tubemeister-deluxe-40.png",
    description:
      "A compact 40-watt all-tube amplifier in a lunchbox format, with clean, crunch, and lead channels. Power Soak and Red Box AE make it suitable for the stage, recording, and low-volume practice.",
    history:
      "The TubeMeister Deluxe 40 builds on the original TubeMeister series and draws its voicing from the TriAmp Mark 3. Key features include Red Box AE speaker simulation, Tube Safety Control, and switchable output power.",
    introduced: null,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: "40 W",
    channels: 3,
    tubes: ["12AX7", "EL84"],
    genres: ["Classic Rock", "Hard Rock", "Blues Rock", "Metal"],
    notableUsers: ["Tommy Thayer"],
    tags: ["lunchbox", "power-soak", "red-box", "recording", "versatile"]
  },
  {
    id: "hughes-kettner-tubemeister-deluxe-20",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "TubeMeister Deluxe 20",
    aliases: [],
    image: "tubemeister-deluxe-20.png",
    description:
      "A 20-watt all-tube amplifier in a compact lunchbox format. Two channels and an integrated boost cover clean, crunch, and high-gain sounds; Power Soak and Red Box AE support use at home, in the studio, and on stage.",
    history:
      "The TubeMeister Deluxe 20 brings the voicing of the TriAmp Mark 3 to a smaller, lighter format. It features a clean channel, a lead channel with boost, integrated speaker simulation, and switchable output power.",
    introduced: null,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: "20 W",
    channels: 2,
    tubes: ["12AX7", "EL84"],
    genres: ["Rock", "Hard Rock", "Blues Rock", "Metal"],
    notableUsers: ["Tommy Thayer"],
    tags: ["lunchbox", "power-soak", "red-box", "recording", "compact"]
  },
  {
    id: "hughes-kettner-black-spirit-200",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "Black Spirit 200",
    aliases: ["Black Spirit 200 Head", "Black Spirit 200 Combo"],
    image: "black-spirit-200.png",
    description:
      "A 200-watt amplifier featuring analog Spirit Tone Generator technology, four channels, and built-in digital effects. It offers programmable sounds, MIDI control, and Red Box AE+ speaker simulation. Unlike traditional tube amps, it does not use vacuum tubes.",
    history:
      "The Black Spirit 200 was introduced in 2018 and combines analog tone generation with digital control and effects. Spirit Tone Generator technology is designed to reproduce the dynamic response of classic tube amplifiers. The family includes head, combo, and floor versions.",
    introduced: 2018,
    discontinued: null,
    country: "Germany",
    ampType: "Solid State",
    power: "200 W",
    channels: 4,
    tubes: [],
    genres: ["Rock", "Hard Rock", "Metal", "Progressive Rock"],
    notableUsers: [],
    tags: ["analog", "programmable", "midi", "built-in-effects", "red-box", "high-power"]
  },
  {
    id: "hughes-kettner-zentera",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "Zentera",
    aliases: ["ZenTera Combo"],
    image: "zentera.png",
    description:
      "An early digital modeling amplifier that brings together a range of classic and modern amp characters in one programmable system. It combines digital amp modeling with extensive presets and built-in effects.",
    history:
      "Introduced in 2000, the Zentera was an early flagship for Hughes & Kettner’s digital modeling technology. It made a wide range of amplifier and effect sounds available in a single stage amp.",
    introduced: 2000,
    discontinued: null,
    country: "Germany",
    ampType: "Modeling",
    power: null,
    channels: null,
    tubes: [],
    genres: ["Rock", "Hard Rock", "Metal", "Progressive Rock"],
    notableUsers: [],
    tags: ["modeling", "digital", "programmable", "effects", "classic"]
  },
  {
    id: "hughes-kettner-tube-100",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "Tube 100",
    aliases: ["H&K Tube 100"],
    image: "tube100.png",
    description:
      "A classic 100-watt all-tube amplifier from the Tube series. It combines traditional tube amplification with separate control of power-stage saturation and output volume.",
    history:
      "The Tube 100 appeared in 1997 as part of the Tube series, an early range of affordable all-tube amplifiers from Hughes & Kettner. According to the manufacturer, independently adjustable power-tube saturation was one of its distinctive features.",
    introduced: 1997,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: "100 W",
    channels: null,
    tubes: [],
    genres: ["Classic Rock", "Hard Rock", "Heavy Metal"],
    notableUsers: [],
    tags: ["classic", "tube-series", "high-power", "rock"]
  },
  {
    id: "hughes-kettner-puretone",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "Puretone",
    aliases: ["Puretone Combo"],
    image: "puretone.png",
    description:
      "A purist single-channel tube amplifier with a direct signal path and organic clean-to-crunch tones. The Growl function creates a rawer character by bypassing the tone controls.",
    history:
      "The Puretone was designed as a deliberately simple amplifier for players who want to emphasize their instrument’s dynamics and natural character. It is documented in Hughes & Kettner’s official product archive and was later recreated as a digital plugin.",
    introduced: null,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: null,
    channels: 1,
    tubes: [],
    genres: ["Blues", "Blues Rock", "Classic Rock"],
    notableUsers: [],
    tags: ["single-channel", "purist", "vintage-voicing", "growl"]
  },
  {
    id: "hughes-kettner-edition-series",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "Edition Series",
    aliases: ["Edition One", "Edition Blonde", "Edition Surf", "Edition Silver"],
    image: "edition-series.png",
    description:
      "A family of solid-state guitar combos with different tonal voicings. The models cover a range of clean, crunch, and rock sounds in a straightforward combo format.",
    history:
      "The Edition series was introduced in 1998. Edition One, Blonde, Surf, and Silver formed an important combo range in the Hughes & Kettner lineup. Because this is a model family, the variants are intentionally grouped in one record.",
    introduced: 1998,
    discontinued: null,
    country: "Germany",
    ampType: "Solid State",
    power: null,
    channels: null,
    tubes: [],
    genres: ["Pop Rock", "Blues Rock", "Classic Rock"],
    notableUsers: [],
    tags: ["combo", "solid-state", "edition-series", "historical"]
  },
  {
    id: "hughes-kettner-grandmeister-36",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "GrandMeister 36",
    aliases: ["Grandmeister 36 Head"],
    image: "grandmeister-36.png",
    description:
      "A programmable 36-watt all-tube amplifier with four channels and built-in digital effects. It offers storable tone configurations and MIDI control in a compact head.",
    history:
      "Introduced in 2013, the GrandMeister 36 brought Hughes & Kettner’s programmable control concept to a more compact tube-amp format. It is documented in the official manufacturer archive, including its user manual.",
    introduced: 2013,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: "36 W",
    channels: 4,
    tubes: ["EL84"],
    genres: ["Rock", "Hard Rock", "Metal", "Pop Rock"],
    notableUsers: [],
    tags: ["programmable", "midi", "built-in-effects", "compact", "versatile"]
  },
  {
    id: "hughes-kettner-trilogy",
    manufacturerId: "hughes-kettner",
    manufacturer: "Hughes & Kettner",
    model: "Trilogy",
    aliases: [],
    image: "trilogy.png",
    description:
      "A multi-channel all-tube amplifier combining classic clean sounds with British-flavored crunch and powerful lead tones. It is aimed at guitarists who need several rock voicings in one stage amp.",
    history:
      "The Trilogy is one of Hughes & Kettner’s historic multi-channel tube amplifiers and is listed in the official product archive with its own user manual. It complements the TriAmp family as a distinct model.",
    introduced: null,
    discontinued: null,
    country: "Germany",
    ampType: "Tube",
    power: null,
    channels: null,
    tubes: [],
    genres: ["Classic Rock", "Hard Rock", "Heavy Metal"],
    notableUsers: [],
    tags: ["multi-channel", "tube", "rock", "historical"]
  }
];

