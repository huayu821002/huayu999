// Country, State/Province, City data for cascading dropdowns
// Simplified dataset - can be expanded

export interface Country {
  code: string
  name: string
  states: State[]
}

export interface State {
  code: string
  name: string
  cities: string[]
}

export const countries: Country[] = [
  // Asia Pacific
  {
    code: 'HK',
    name: '中国香港',
    states: [
      { code: 'HK', name: '中国香港', cities: ['Hong Kong Island', 'Kowloon', 'New Territories'] },
    ],
  },
  {
    code: 'MO',
    name: '中国澳门',
    states: [
      { code: 'MO', name: '中国澳门', cities: ['Macau Peninsula', 'Taipa', 'Coloane'] },
    ],
  },
  {
    code: 'TW',
    name: '中国台湾',
    states: [
      { code: 'TW', name: 'Taiwan', cities: ['Taipei', 'New Taipei', 'Taichung', 'Kaohsiung', 'Keelung', 'Taoyuan', 'Hsinchu'] },
    ],
  },
  {
    code: 'JP',
    name: 'Japan',
    states: [
      { code: 'TK', name: 'Tokyo', cities: ['Tokyo', 'Hachioji', 'Machida', 'Suginami', 'Shinagawa'] },
      { code: 'OS', name: 'Osaka', cities: ['Osaka', 'Sakai', 'Higashiosaka', 'Toyonaka', 'Suita'] },
      { code: 'KT', name: 'Kanagawa', cities: ['Yokohama', 'Kawasaki', 'Sagamihara', 'Fujisawa', 'Miura'] },
      { code: 'AJ', name: 'Aichi', cities: ['Nagoya', 'Toyota', 'Okazaki', 'Toyohashi', 'Kasugai'] },
    ],
  },
  {
    code: 'KR',
    name: 'South Korea',
    states: [
      { code: 'SE', name: 'Seoul', cities: ['Seoul'] },
      { code: 'KG', name: 'Gyeonggi', cities: ['Suwon', 'Seongnam', 'Goyang', 'Yongin', 'Bucheon'] },
      { code: 'BS', name: 'Busan', cities: ['Busan'] },
      { code: 'IC', name: 'Incheon', cities: ['Incheon'] },
      { code: 'DJ', name: 'Daejeon', cities: ['Daejeon'] },
    ],
  },
  {
    code: 'SG',
    name: 'Singapore',
    states: [
      { code: 'SG', name: 'Singapore', cities: ['Singapore'] },
    ],
  },
  {
    code: 'MY',
    name: 'Malaysia',
    states: [
      { code: 'KL', name: 'Kuala Lumpur', cities: ['Kuala Lumpur'] },
      { code: 'JH', name: 'Johor', cities: ['Johor Bahru'] },
      { code: 'PN', name: 'Penang', cities: ['George Town'] },
    ],
  },
  {
    code: 'TH',
    name: 'Thailand',
    states: [
      { code: 'BK', name: 'Bangkok', cities: ['Bangkok'] },
      { code: 'CH', name: 'Chiang Mai', cities: ['Chiang Mai'] },
      { code: 'PT', name: 'Phuket', cities: ['Phuket'] },
    ],
  },
  {
    code: 'VN',
    name: 'Vietnam',
    states: [
      { code: 'HN', name: 'Hanoi', cities: ['Hanoi'] },
      { code: 'HCM', name: 'Ho Chi Minh City', cities: ['Ho Chi Minh City'] },
      { code: 'DN', name: 'Da Nang', cities: ['Da Nang'] },
    ],
  },
  {
    code: 'PH',
    name: 'Philippines',
    states: [
      { code: 'MM', name: 'Metro Manila', cities: ['Manila', 'Quezon City', 'Makati'] },
      { code: 'CE', name: 'Cebu', cities: ['Cebu City'] },
      { code: 'DV', name: 'Davao', cities: ['Davao City'] },
    ],
  },
  {
    code: 'ID',
    name: 'Indonesia',
    states: [
      { code: 'JK', name: 'Jakarta', cities: ['Jakarta'] },
      { code: 'JR', name: 'East Java', cities: ['Surabaya'] },
      { code: 'BD', name: 'Bali', cities: ['Denpasar', 'Bali'] },
    ],
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    states: [
      { code: 'AUK', name: 'Auckland', cities: ['Auckland'] },
      { code: 'WGN', name: 'Wellington', cities: ['Wellington'] },
      { code: 'CAN', name: 'Canterbury', cities: ['Christchurch'] },
      { code: 'OTA', name: 'Otago', cities: ['Dunedin'] },
    ],
  },
  // South America
  {
    code: 'BR',
    name: 'Brazil',
    states: [
      { code: 'SP', name: 'São Paulo', cities: ['São Paulo', 'Campinas', 'Santos', 'São Bernardo', 'São José'] },
      { code: 'RJ', name: 'Rio de Janeiro', cities: ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói'] },
      { code: 'MG', name: 'Minas Gerais', cities: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Betim', 'Juiz de Fora'] },
      { code: 'DF', name: 'Distrito Federal', cities: ['Brasília', 'Taguatinga', 'Ceilândia', 'Samambaia', 'Planaltina'] },
    ],
  },
  {
    code: 'AR',
    name: 'Argentina',
    states: [
      { code: 'BA', name: 'Buenos Aires', cities: ['Buenos Aires'] },
      { code: 'CB', name: 'Córdoba', cities: ['Córdoba'] },
      { code: 'SF', name: 'Santa Fe', cities: ['Rosario', 'Santa Fe'] },
    ],
  },
  {
    code: 'CO',
    name: 'Colombia',
    states: [
      { code: 'DC', name: 'Bogotá', cities: ['Bogotá'] },
      { code: 'AN', name: 'Antioquia', cities: ['Medellín'] },
      { code: 'VC', name: 'Valle del Cauca', cities: ['Cali'] },
    ],
  },
  {
    code: 'PE',
    name: 'Peru',
    states: [
      { code: 'LIM', name: 'Lima', cities: ['Lima'] },
      { code: 'ARE', name: 'Arequipa', cities: ['Arequipa'] },
      { code: 'CUZ', name: 'Cusco', cities: ['Cusco'] },
    ],
  },
  {
    code: 'CL',
    name: 'Chile',
    states: [
      { code: 'RM', name: 'Santiago', cities: ['Santiago'] },
      { code: 'VS', name: 'Valparaíso', cities: ['Valparaíso', 'Viña del Mar'] },
      { code: 'BI', name: 'Bío Bío', cities: ['Concepción'] },
    ],
  },

  // Americas
  {
    code: 'US',
    name: 'United States',
    states: [
      { code: 'CA', name: 'California', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'Fresno'] },
      { code: 'NY', name: 'New York', cities: ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Syracuse'] },
      { code: 'TX', name: 'Texas', cities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth'] },
      { code: 'FL', name: 'Florida', cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Tallahassee'] },
      { code: 'IL', name: 'Illinois', cities: ['Chicago', 'Springfield', 'Rockford', 'Peoria', 'Naperville'] },
      { code: 'WA', name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'] },
      { code: 'NV', name: 'Nevada', cities: ['Las Vegas', 'Reno', 'Henderson', 'Carson City', 'Sparks'] },
      { code: 'AZ', name: 'Arizona', cities: ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale', 'Flagstaff'] },
      { code: 'CO', name: 'Colorado', cities: ['Denver', 'Boulder', 'Colorado Springs', 'Aurora', 'Fort Collins'] },
      { code: 'GA', name: 'Georgia', cities: ['Atlanta', 'Savannah', 'Augusta', 'Macon', 'Athens'] },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    states: [
      { code: 'ON', name: 'Ontario', cities: ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton', 'London'] },
      { code: 'BC', name: 'British Columbia', cities: ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond'] },
      { code: 'QC', name: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Sherbrooke'] },
      { code: 'AB', name: 'Alberta', cities: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'Airdrie'] },
    ],
  },
  {
    code: 'MX',
    name: 'Mexico',
    states: [
      { code: 'CMX', name: 'Mexico City', cities: ['Mexico City'] },
      { code: 'JAL', name: 'Jalisco', cities: ['Guadalajara', 'Zapotlanejo', 'Tonalá', 'Puerto Vallarta', 'Lagos de Moreno'] },
      { code: 'NL', name: 'Nuevo León', cities: ['Monterrey', 'Guadalupe', 'San Nicolás', 'Apodaca', 'Santa Catarina'] },
      { code: 'GUA', name: 'Guanajuato', cities: ['León', 'Celaya', 'Irapuato', 'Salamanca', 'Guanajuato'] },
    ],
  },
  {
    code: 'IN',
    name: 'India',
    states: [
      { code: 'MH', name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik'] },
      { code: 'DL', name: 'Delhi', cities: ['New Delhi', 'Delhi', 'Gurgaon', 'Noida', 'Faridabad'] },
      { code: 'KA', name: 'Karnataka', cities: ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum'] },
      { code: 'TN', name: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem'] },
      { code: 'UP', name: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Meerut'] },
    ],
  },
  // Europe (EU Countries)
  {
    code: 'GB',
    name: 'United Kingdom',
    states: [
      { code: 'EN', name: 'England', cities: ['London', 'Birmingham', 'Manchester', 'Leeds', 'Liverpool', 'Sheffield', 'Bristol'] },
      { code: 'SC', name: 'Scotland', cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness'] },
      { code: 'WA', name: 'Wales', cities: ['Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Barry'] },
      { code: 'NI', name: 'Northern Ireland', cities: ['Belfast', 'Derry', 'Lisburn', 'Newry', 'Armagh'] },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    states: [
      { code: 'BY', name: 'Bavaria', cities: ['Munich', 'Nuremberg', 'Augsburg', 'Regensburg', 'Würzburg'] },
      { code: 'BE', name: 'Berlin', cities: ['Berlin'] },
      { code: 'HH', name: 'Hamburg', cities: ['Hamburg'] },
      { code: 'HE', name: 'Hesse', cities: ['Frankfurt', 'Wiesbaden', 'Darmstadt', 'Kassel', 'Marburg'] },
      { code: 'NW', name: 'North Rhine-Westphalia', cities: ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen', 'Duisburg'] },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    states: [
      { code: 'IDF', name: 'Île-de-France', cities: ['Paris', 'Saint-Denis', 'Boulogne-Billancourt', 'Argenteuil', 'Montreuil'] },
      { code: 'ARA', name: 'Auvergne-Rhône-Alpes', cities: ['Lyon', 'Saint-Étienne', 'Grenoble', 'Villeurbanne', 'Clermont-Ferrand'] },
      { code: 'PAC', name: 'Provence-Alpes-Côte d\'Azur', cities: ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Avignon'] },
      { code: 'OCC', name: 'Occitanie', cities: ['Toulouse', 'Montpellier', 'Nîmes', 'Perpignan', 'Béziers'] },
    ],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    states: [
      { code: 'NH', name: 'North Holland', cities: ['Amsterdam', 'Haarlem', 'Zaanstad', 'Hoorn', 'Alkmaar'] },
      { code: 'ZH', name: 'South Holland', cities: ['Rotterdam', 'The Hague', 'Dordrecht', 'Schiedam', 'Zoetermeer'] },
      { code: 'UT', name: 'Utrecht', cities: ['Utrecht', 'Amersfoort', 'Nieuwegein', 'Zeist', 'Doetinchem'] },
    ],
  },
  {
    code: 'IT',
    name: 'Italy',
    states: [
      { code: 'LAZ', name: 'Lazio', cities: ['Rome', 'Latina', 'Fiumicino', 'Guidonia', 'Aprilia'] },
      { code: 'LOM', name: 'Lombardy', cities: ['Milan', 'Brescia', 'Monza', 'Bergamo', 'Como'] },
      { code: 'CAM', name: 'Campania', cities: ['Naples', 'Salerno', 'Giugliano', 'Torre del Greco', 'Pozzuoli'] },
      { code: 'VEN', name: 'Veneto', cities: ['Venice', 'Verona', 'Padua', 'Treviso', 'Vicenza'] },
    ],
  },
  {
    code: 'ES',
    name: 'Spain',
    states: [
      { code: 'MD', name: 'Madrid', cities: ['Madrid', 'Parla', 'Fuenlabrada', 'Móstoles', 'Alcalá de Henares'] },
      { code: 'CT', name: 'Catalonia', cities: ['Barcelona', "L'Hospitalet", 'Terrassa', 'Badalona', 'Sabadell'] },
      { code: 'VC', name: 'Valencia', cities: ['Valencia', 'Alicante', 'Elche', 'Castellón', 'Sagunto'] },
      { code: 'AN', name: 'Andalusia', cities: ['Seville', 'Malaga', 'Córdoba', 'Granada', 'Jerez'] },
    ],
  },
  {
    code: 'PL',
    name: 'Poland',
    states: [
      { code: 'MZ', name: 'Masovian', cities: ['Warsaw'] },
      { code: 'KR', name: 'Kraków', cities: ['Kraków'] },
      { code: 'LD', name: 'Łódź', cities: ['Łódź'] },
      { code: 'PO', name: 'Greater Poland', cities: ['Poznań'] },
    ],
  },
  {
    code: 'BE',
    name: 'Belgium',
    states: [
      { code: 'BRU', name: 'Brussels', cities: ['Brussels'] },
      { code: 'ANW', name: 'Antwerp', cities: ['Antwerp', 'Mechelen'] },
      { code: 'WFL', name: 'East Flanders', cities: ['Ghent', 'Aalst'] },
    ],
  },
  {
    code: 'SE',
    name: 'Sweden',
    states: [
      { code: 'ST', name: 'Stockholm', cities: ['Stockholm'] },
      { code: 'GD', name: 'Gothenburg', cities: ['Gothenburg'] },
      { code: 'MU', name: 'Malmö', cities: ['Malmö'] },
    ],
  },
  {
    code: 'AT',
    name: 'Austria',
    states: [
      { code: 'VI', name: 'Vienna', cities: ['Vienna'] },
      { code: 'ST', name: 'Styria', cities: ['Graz'] },
      { code: 'SZ', name: 'Salzburg', cities: ['Salzburg'] },
    ],
  },
  {
    code: 'PT',
    name: 'Portugal',
    states: [
      { code: 'LI', name: 'Lisbon', cities: ['Lisbon'] },
      { code: 'PO', name: 'Porto', cities: ['Porto'] },
      { code: 'BR', name: 'Braga', cities: ['Braga'] },
    ],
  },
  {
    code: 'GR',
    name: 'Greece',
    states: [
      { code: 'AT', name: 'Attica', cities: ['Athens'] },
      { code: 'TH', name: 'Thessaloniki', cities: ['Thessaloniki'] },
      { code: 'CR', name: 'Crete', cities: ['Heraklion', 'Chania'] },
    ],
  },
  {
    code: 'CZ',
    name: 'Czech Republic',
    states: [
      { code: 'PR', name: 'Prague', cities: ['Prague'] },
      { code: 'JM', name: 'South Moravia', cities: ['Brno'] },
      { code: 'MO', name: 'Moravia-Silesia', cities: ['Ostrava'] },
    ],
  },
  {
    code: 'RO',
    name: 'Romania',
    states: [
      { code: 'B', name: 'Bucharest', cities: ['Bucharest'] },
      { code: 'CJ', name: 'Cluj', cities: ['Cluj-Napoca'] },
      { code: 'IS', name: 'Iași', cities: ['Iași'] },
    ],
  },
  {
    code: 'HU',
    name: 'Hungary',
    states: [
      { code: 'BU', name: 'Budapest', cities: ['Budapest'] },
      { code: 'PE', name: 'Pest', cities: ['Érd'] },
      { code: 'GY', name: 'Győr', cities: ['Győr'] },
    ],
  },
  {
    code: 'CH',
    name: 'Switzerland',
    states: [
      { code: 'ZH', name: 'Zurich', cities: ['Zurich'] },
      { code: 'GE', name: 'Geneva', cities: ['Geneva'] },
      { code: 'BE', name: 'Bern', cities: ['Bern'] },
    ],
  },
  {
    code: 'NO',
    name: 'Norway',
    states: [
      { code: 'OS', name: 'Oslo', cities: ['Oslo'] },
      { code: 'BU', name: 'Bergen', cities: ['Bergen'] },
      { code: 'ST', name: 'Stavanger', cities: ['Stavanger'] },
    ],
  },
  {
    code: 'DK',
    name: 'Denmark',
    states: [
      { code: 'DK', name: 'Copenhagen', cities: ['Copenhagen'] },
      { code: 'AR', name: 'Aarhus', cities: ['Aarhus'] },
      { code: 'OD', name: 'Odense', cities: ['Odense'] },
    ],
  },
  {
    code: 'FI',
    name: 'Finland',
    states: [
      { code: 'UF', name: 'Uusimaa', cities: ['Helsinki'] },
      { code: 'TR', name: 'Tampere', cities: ['Tampere'] },
      { code: 'TK', name: 'Turku', cities: ['Turku'] },
    ],
  },
  {
    code: 'IE',
    name: 'Ireland',
    states: [
      { code: 'D', name: 'Dublin', cities: ['Dublin'] },
      { code: 'C', name: 'Cork', cities: ['Cork'] },
      { code: 'G', name: 'Galway', cities: ['Galway'] },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    states: [
      { code: 'NSW', name: 'New South Wales', cities: ['Sydney', 'Newcastle', 'Wollongong', 'Central Coast', 'Paramatta'] },
      { code: 'VIC', name: 'Victoria', cities: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Melton'] },
      { code: 'QLD', name: 'Queensland', cities: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns'] },
      { code: 'WA', name: 'Western Australia', cities: ['Perth', 'Fremantle', 'Rockingham', 'Mandurah', 'Kalgoorlie'] },
      { code: 'SA', name: 'South Australia', cities: ['Adelaide', 'Mount Gambier', 'Port Adelaide', 'Salisbury', 'Tea Tree Gully'] },
    ],
  },
]

export function getCountryByCode(code: string): Country | undefined {
  return countries.find(c => c.code === code)
}

export function getStatesByCountry(countryCode: string): State[] {
  const country = getCountryByCode(countryCode)
  return country?.states || []
}

export function getCitiesByState(countryCode: string, stateCode: string): string[] {
  const country = getCountryByCode(countryCode)
  const state = country?.states.find(s => s.code === stateCode)
  return state?.cities || []
}
