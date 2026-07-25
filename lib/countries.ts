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
    code: 'HK',
    name: 'Hong Kong SAR, China',
    states: [
      { code: 'HK', name: 'Hong Kong', cities: ['Hong Kong Island', 'Kowloon', 'New Territories'] },
    ],
  },
  {
    code: 'MO',
    name: 'Macau SAR, China',
    states: [
      { code: 'MO', name: 'Macau', cities: ['Macau Peninsula', 'Taipa', 'Coloane'] },
    ],
  },
  {
    code: 'TW',
    name: 'Taiwan',
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
      { code: 'LAZ', name: 'Lazio', cities: ['Rome', 'Latina', 'Fiumicino', ' Guidonia', ' Aprilia'] },
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
      { code: 'CT', name: 'Catalonia', cities: ['Barcelona', 'L\'Hospitalet', 'Terrassa', 'Badalona', 'Sabadell'] },
      { code: 'VC', name: 'Valencia', cities: ['Valencia', 'Alicante', 'Elche', 'Castellón', 'Sagunto'] },
      { code: 'AN', name: 'Andalusia', cities: ['Seville', 'Malaga', 'Córdoba', 'Granada', 'Jerez'] },
    ],
  },
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
