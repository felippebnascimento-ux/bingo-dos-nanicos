/** Nomes oficiais da Riot. Usados no autocompletar e para corrigir maiúsculas (`canon`). */
export const CHAMPS: readonly string[] = [
  "Aatrox", "Ahri", "Akali", "Akshan", "Alistar", "Ambessa", "Amumu", "Anivia",
  "Annie", "Aphelios", "Ashe", "Aurelion Sol", "Aurora", "Azir", "Bard", "Bel'Veth",
  "Blitzcrank", "Brand", "Braum", "Briar", "Caitlyn", "Camille", "Cassiopeia", "Cho'Gath",
  "Corki", "Darius", "Diana", "Dr. Mundo", "Draven", "Ekko", "Elise", "Evelynn",
  "Ezreal", "Fiddlesticks", "Fiora", "Fizz", "Galio", "Gangplank", "Garen", "Gnar",
  "Gragas", "Graves", "Gwen", "Hecarim", "Heimerdinger", "Hwei", "Illaoi", "Irelia",
  "Ivern", "Janna", "Jarvan IV", "Jax", "Jayce", "Jhin", "Jinx", "K'Sante",
  "Kai'Sa", "Kalista", "Karma", "Karthus", "Kassadin", "Katarina", "Kayle", "Kayn",
  "Kennen", "Kha'Zix", "Kindred", "Kled", "Kog'Maw", "LeBlanc", "Lee Sin", "Leona",
  "Lillia", "Lissandra", "Lucian", "Lulu", "Lux", "Malphite", "Malzahar", "Maokai",
  "Master Yi", "Mel", "Milio", "Miss Fortune", "Mordekaiser", "Morgana", "Naafiri", "Nami",
  "Nasus", "Nautilus", "Neeko", "Nidalee", "Nilah", "Nocturne", "Nunu & Willump", "Olaf",
  "Orianna", "Ornn", "Pantheon", "Poppy", "Pyke", "Qiyana", "Quinn", "Rakan",
  "Rammus", "Rek'Sai", "Rell", "Renata Glasc", "Renekton", "Rengar", "Riven", "Rumble",
  "Ryze", "Samira", "Sejuani", "Senna", "Seraphine", "Sett", "Shaco", "Shen",
  "Shyvana", "Singed", "Sion", "Sivir", "Skarner", "Smolder", "Sona", "Soraka",
  "Swain", "Sylas", "Syndra", "Tahm Kench", "Taliyah", "Talon", "Taric", "Teemo",
  "Thresh", "Tristana", "Trundle", "Tryndamere", "Twisted Fate", "Twitch", "Udyr", "Urgot",
  "Varus", "Vayne", "Veigar", "Vel'Koz", "Vex", "Vi", "Viego", "Viktor",
  "Vladimir", "Volibear", "Warwick", "Wukong", "Xayah", "Xerath", "Xin Zhao", "Yasuo",
  "Yone", "Yorick", "Yunara", "Yuumi", "Zaahen", "Zac", "Zed", "Zeri",
  "Ziggs", "Zilean", "Zoe", "Zyra",
];

export const LANES = ["Top", "Jungle", "Mid", "ADC", "Suporte"] as const;

/**
 * Lane mais comum de cada campeão (T=Top J=Jungle M=Mid A=ADC S=Suporte; a primeira letra é a principal).
 * Usado na escalação automática quando a Riot mostra a partida ao vivo.
 */
export const LANE_CAMP: Readonly<Record<string, string>> = {
  "Aatrox": "T", "Ahri": "M", "Akali": "MT", "Akshan": "MA", "Alistar": "S", "Ambessa": "TJ",
  "Amumu": "JS", "Anivia": "M", "Annie": "MS", "Aphelios": "A", "Ashe": "AS", "Aurelion Sol": "M",
  "Aurora": "MT", "Azir": "M", "Bard": "S", "Bel'Veth": "J", "Blitzcrank": "S", "Brand": "SMJ",
  "Braum": "S", "Briar": "J", "Caitlyn": "A", "Camille": "TS", "Cassiopeia": "MT", "Cho'Gath": "TMJ",
  "Corki": "MA", "Darius": "T", "Diana": "JM", "Dr. Mundo": "TJ", "Draven": "A", "Ekko": "JM",
  "Elise": "J", "Evelynn": "J", "Ezreal": "AM", "Fiddlesticks": "JS", "Fiora": "T", "Fizz": "M",
  "Galio": "MS", "Gangplank": "T", "Garen": "T", "Gnar": "T", "Gragas": "JTMS", "Graves": "J",
  "Gwen": "TJ", "Hecarim": "J", "Heimerdinger": "MTS", "Hwei": "MS", "Illaoi": "T", "Irelia": "TM",
  "Ivern": "J", "Janna": "S", "Jarvan IV": "J", "Jax": "TJ", "Jayce": "TM", "Jhin": "A",
  "Jinx": "A", "K'Sante": "T", "Kai'Sa": "A", "Kalista": "A", "Karma": "SM", "Karthus": "JM",
  "Kassadin": "M", "Katarina": "M", "Kayle": "TM", "Kayn": "J", "Kennen": "T", "Kha'Zix": "J",
  "Kindred": "J", "Kled": "T", "Kog'Maw": "A", "LeBlanc": "M", "Lee Sin": "J", "Leona": "S",
  "Lillia": "J", "Lissandra": "M", "Lucian": "AM", "Lulu": "S", "Lux": "SM", "Malphite": "TS",
  "Malzahar": "M", "Maokai": "SJT", "Master Yi": "J", "Mel": "MS", "Milio": "S", "Miss Fortune": "A",
  "Mordekaiser": "T", "Morgana": "SJ", "Naafiri": "MJ", "Nami": "S", "Nasus": "T", "Nautilus": "S",
  "Neeko": "MS", "Nidalee": "J", "Nilah": "A", "Nocturne": "J", "Nunu & Willump": "J", "Olaf": "JT",
  "Orianna": "M", "Ornn": "T", "Pantheon": "SMTJ", "Poppy": "JTS", "Pyke": "S", "Qiyana": "MJ",
  "Quinn": "T", "Rakan": "S", "Rammus": "J", "Rek'Sai": "J", "Rell": "S", "Renata Glasc": "S",
  "Renekton": "T", "Rengar": "JT", "Riven": "T", "Rumble": "TM", "Ryze": "MT", "Samira": "A",
  "Sejuani": "J", "Senna": "SA", "Seraphine": "SMA", "Sett": "TS", "Shaco": "JS", "Shen": "TS",
  "Shyvana": "J", "Singed": "T", "Sion": "T", "Sivir": "A", "Skarner": "JT", "Smolder": "AM",
  "Sona": "S", "Soraka": "S", "Swain": "SMA", "Sylas": "MJ", "Syndra": "M", "Tahm Kench": "ST",
  "Taliyah": "JM", "Talon": "MJ", "Taric": "S", "Teemo": "T", "Thresh": "S", "Tristana": "AM",
  "Trundle": "JT", "Tryndamere": "T", "Twisted Fate": "M", "Twitch": "A", "Udyr": "JT", "Urgot": "T",
  "Varus": "A", "Vayne": "AT", "Veigar": "MA", "Vel'Koz": "SM", "Vex": "M", "Vi": "J",
  "Viego": "J", "Viktor": "M", "Vladimir": "MT", "Volibear": "TJ", "Warwick": "JT", "Wukong": "JT",
  "Xayah": "A", "Xerath": "SM", "Xin Zhao": "J", "Yasuo": "MT", "Yone": "MT", "Yorick": "T",
  "Yunara": "A", "Yuumi": "S", "Zaahen": "TJ", "Zac": "J", "Zed": "MJ", "Zeri": "A",
  "Ziggs": "AM", "Zilean": "SM", "Zoe": "M", "Zyra": "S",
};
