export const CAB_BRAND_ALIASES = {
  marshall: ["mars"],
  mesa: ["mesa boogie", "boogie", "mebo"],
  diezel: ["diesel"],
  friedman: ["fried man"],
  bogner: ["bogus"],
  fender: ["fan"]
};

/**
 * Image-map entries.
 * `aliases` + `configuration` (speaker format) are matching-only.
 * `manufacturer`, `model`, and optional `variant` are display-only.
 */
export const cabinetImageMap = [
  {
    image: "palmer112.png",
    configuration: "1x12",
    manufacturer: "Palmer",
    model: "1x12",
    aliases: [
      "palmer"
    ]
  },

  {
    image: "fender showman 1x12.png",
    configuration: "1x12",
    manufacturer: "Fender",
    model: "Showman 1x12",
    aliases: [
      "showgirl",
	  "fan showman"
    ]
  },

  {
    image: "orange ppc112 1x12.png",
    configuration: "1x12",
    manufacturer: "Orange",
    model: "PPC112",
    aliases: [
      "ppc112"
    ]
  },

  {
    image: "orange ppc212 2x12.png",
    configuration: "2x12",
    manufacturer: "Orange",
    model: "PPC212",
    aliases: [
      "ppc212"
    ]
  },

  {
    image: "orange ppc212ob 2x12.png",
    configuration: "2x12",
    manufacturer: "Orange",
    model: "PPC212",
    variant: "Open Back",
    aliases: [
      "ppc212ob"
    ]
  },
  {
    image: "3rd-power-2x12.png",
    configuration: "2x12",
    manufacturer: "3rd Power",
    model: "2x12",
    aliases: [
      "3rd power 2x12",
      "3rd power",
      "3rd powder",
      "3rd powder 212",
      "3rd power 2 x 12",
      "3rd powder 2x12"

    ]
  },

  {
    image: "orange crush pro 4x12.png",
    configuration: "4x12",
    manufacturer: "Orange",
    model: "Crush Pro 4x12",
    aliases: [
      "orange crush",
      "crush pro"
    ]
  },

  {
    image: "mesa boogie roadking 4x12.png",
    configuration: "4x12",
    manufacturer: "Mesa/Boogie",
    model: "Road King 4x12",
    aliases: [
      "roadking",
      "road king"
    ]
  },

  {
    image: "mesa boogie rectifier oversize 4x12.png",
    configuration: "4x12",
    manufacturer: "Mesa/Boogie",
    model: "Rectifier 4x12",
    variant: "Oversized",
    aliases: [
      "rectifier oversize",
      "oversize",
      "oversized",
      "mebo 412os"
    ]
  },

  {
    image: "mesa boogie recto traditional straight 4x12.png",
    configuration: "4x12",
    manufacturer: "Mesa/Boogie",
    model: "Rectifier 4x12",
    variant: "Straight",
    aliases: [
      "recto traditional",
      "mesa traditional",
      "rectifier",
	  "mesa"
    ]
  },

  {
    image: "mesa boogie recto vertical 2x12.png",
    configuration: "2x12",
    manufacturer: "Mesa/Boogie",
    model: "Rectifier 2x12",
    variant: "Vertical",
    aliases: [
      "recto vertical",
      "vertical"
    ]
  },

  {
    image: "mesa boogie recto horizontal 2x12.png",
    configuration: "2x12",
    manufacturer: "Mesa/Boogie",
    model: "Rectifier 2x12",
    variant: "Horizontal",
    aliases: [
      "recto horizontal",
      "horizontal"
    ]
  },

  {
    image: "mesa boogie rectifier 1x12.png",
    configuration: "1x12",
    manufacturer: "Mesa/Boogie",
    model: "Rectifier 1x12",
    aliases: [
      "rectifier 1x12"
    ]
  },

  {
    image: "mesa boogie california tweed 1x12.png",
    configuration: "1x12",
    manufacturer: "Mesa/Boogie",
    model: "California Tweed 1x12",
    aliases: [
      "california tweed 1x12"
    ]
  },

  {
    image: "mesa boogie california tweed 2x12.png",
    configuration: "2x12",
    manufacturer: "Mesa/Boogie",
    model: "California Tweed 2x12",
    aliases: [
      "california tweed 2x12",
      "cali tweed"
    ]
  },

  {
    image: "marshall 1960av 4x12.png",
    configuration: "4x12",
    manufacturer: "Marshall",
    model: "1960AV 4x12",
    aliases: [
      "1960",
      "1960av",
      "mars 1960",
      "marshall",
      "mars 4x12",
      "mars 4*12",
      "nineteen sixty",
      "mars nineteen sixty"
    ]
  },

  {
    image: "marshall mx412a 4x12.png",
    configuration: "4x12",
    manufacturer: "Marshall",
    model: "MX412A",
    aliases: [
      "mx412",
      "mx412a"
    ]
  },

  {
    image: "marshall 2x12.png",
    configuration: "2x12",
    manufacturer: "Marshall",
    model: "2x12",
    aliases: [
      "marshall 2x12",
      "mars 2x12",
      "marshall",
      "mars"
    ]
  },

  {
    image: "marshall 1x12.png",
    configuration: "1x12",
    manufacturer: "Marshall",
    model: "1x12",
    aliases: [
      "marshall 1x12",
      "mars 1x12",
      "marshall",
      "mars"
    ]
  },

  {
    image: "friedman112.png",
    configuration: "1x12",
    manufacturer: "Friedman Amplification",
    model: "1x12",
    aliases: [
      "friedman 112",
      "friedman 1x12",
      "fried man 112"
    ]
  },

  {
    image: "friedman_212.png",
    configuration: "2x12",
    manufacturer: "Friedman Amplification",
    model: "2x12",
    aliases: [
      "friedman 212",
      "friedman 2x12",
      "fried man 212"
    ]
  },

  {
    image: "FRIEDMAN_2x12_vertical.png",
    configuration: "2x12",
    manufacturer: "Friedman Amplification",
    model: "2x12",
    variant: "Vertical",
    aliases: [
      "friedman vertical",
      "vertical friedman"
    ]
  },

  {
    image: "friedman_412.png",
    configuration: "4x12",
    manufacturer: "Friedman Amplification",
    model: "4x12",
    aliases: [
      "friedman 412",
      "friedman 4x12",
      "fried man 412",
	  "friedman checkered"
    ]
  },

  {
    image: "evh 5150 iii 2x12.png",
    configuration: "2x12",
    manufacturer: "EVH",
    model: "5150III 2x12",
    aliases: [
      "5150 iii 2x12",
      "5150 2x12"
    ]
  },

  {
    image: "evh 5150 iii 4x12.png",
    configuration: "4x12",
    manufacturer: "EVH",
    model: "5150III 4x12",
    aliases: [
      "5150 iii 4x12",
      "5150 4x12",
	  "evh 5150"
    ]
  },

  {
    image: "diezel 4x12.png",
    configuration: "4x12",
    manufacturer: "Diezel",
    model: "4x12",
    aliases: [
      "diezel",
      "diesel"
    ]
  },

  {
    image: "bogner 2x12 big.png",
    configuration: "2x12",
    manufacturer: "Bogner",
    model: "2x12",
    aliases: [
      "bogner 2x12",
	  "bogner 2 x 12",
      "bogner 212",
      "bogus 2x12",
	  "bogus 2*12"
    ]
  },

  {
    image: "bogner 4x12.png",
    configuration: "4x12",
    manufacturer: "Bogner",
    model: "4x12",
    aliases: [
      "bogner 4x12",
      "bogner 412",
      "bogus 4x12",
	  "bogner uberkab"
    ]
  },
  
  {
    image: "soldano 4x12.png",
    configuration: "4x12",
    manufacturer: "Soldano",
    model: "4x12",
    aliases: [
      "soldano 4x12",
      "soldano 412",
      "slo 4x12"
    ]
  },
  
  {
      image: "hiwatt 4x12.png",
    configuration: "4x12",
    manufacturer: "Hiwatt",
    model: "4x12",
    aliases: [
      "hiwatt 4x12",
      "fanny",
      "high watt"
    ]
  }
];
