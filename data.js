// District HQ coordinates are approximate (used for map centring only).
const DISTRICTS=[["Ariyalur",11.14,79.08],["Chengalpattu",12.69,79.98],["Chennai",13.08,80.27],["Coimbatore",11.00,76.96],["Cuddalore",11.75,79.77],["Dharmapuri",12.13,78.16],["Dindigul",10.36,77.98],["Erode",11.34,77.72],["Kallakurichi",11.74,78.96],["Kancheepuram",12.83,79.70],["Kanyakumari",8.18,77.43],["Karur",10.96,78.08],["Krishnagiri",12.52,78.21],["Madurai",9.92,78.12],["Mayiladuthurai",11.10,79.65],["Nagapattinam",10.77,79.84],["Namakkal",11.22,78.17],["Nilgiris",11.41,76.70],["Perambalur",11.23,78.88],["Pudukkottai",10.38,78.82],["Ramanathapuram",9.37,78.83],["Ranipet",12.93,79.33],["Salem",11.66,78.15],["Sivagangai",9.85,78.48],["Tenkasi",8.96,77.31],["Thanjavur",10.79,79.14],["Theni",10.01,77.48],["Thoothukudi",8.76,78.13],["Tiruchirappalli",10.79,78.70],["Tirunelveli",8.71,77.76],["Tirupathur",12.50,78.57],["Tiruppur",11.11,77.34],["Tiruvallur",13.14,79.91],["Tiruvannamalai",12.23,79.07],["Tiruvarur",10.77,79.64],["Vellore",12.92,79.13],["Viluppuram",11.94,79.49],["Virudhunagar",9.59,77.96]].map(([name,lat,lng])=>({name,lat,lng}));
const GAS_BY_CATEGORY={"Petroleum & Refinery":["CH4","H2S","CO"],"Chemical Manufacturing":["Cl2","NH3","CO"],"Fertilizer":["NH3","CO2"],"LPG Storage & Distribution":["LEL","CO"],"Industrial Gas Manufacturing":["O2","CO2"],"Hospital / Medical Gas":["O2","CO2"],"Pharmaceutical":["NH3","CO2"],"Food & Beverage":["CO2","NH3"],"Welding & Fabrication":["CO","O2"],"Steel & Metal Processing":["CO","CO2"],"Power Plant":["CO","CH4"],"City Gas Distribution":["CH4","LEL"],"Other":["CO"]};
const CATEGORIES=Object.keys(GAS_BY_CATEGORY);
// ILLUSTRATIVE DEFAULTS ONLY - set per gas/site/regulation (OSHA, NIOSH, Factories Act TN rules, site HAZOP) via PUT /api/thresholds/:gas.
// mode "high": status rises when value >= level. mode "low": status rises when value <= level (oxygen deficiency).
const DEFAULT_THRESHOLDS={
 CO:{name:"Carbon monoxide (CO)",unit:"ppm",mode:"high",warning:35,critical:100,danger:200},
 CO2:{name:"Carbon dioxide (CO₂)",unit:"ppm",mode:"high",warning:5000,critical:15000,danger:40000},
 CH4:{name:"Methane (CH₄)",unit:"%LEL",mode:"high",warning:10,critical:25,danger:50},
 LEL:{name:"Combustible gas / LPG",unit:"%LEL",mode:"high",warning:10,critical:25,danger:50},
 H2S:{name:"Hydrogen sulfide (H₂S)",unit:"ppm",mode:"high",warning:5,critical:10,danger:50},
 NH3:{name:"Ammonia (NH₃)",unit:"ppm",mode:"high",warning:25,critical:50,danger:150},
 Cl2:{name:"Chlorine (Cl₂)",unit:"ppm",mode:"high",warning:0.5,critical:1,danger:5},
 O2:{name:"Oxygen (O₂)",unit:"% vol",mode:"low",warning:19.5,critical:18,danger:16}
};
module.exports={DISTRICTS,CATEGORIES,GAS_BY_CATEGORY,DEFAULT_THRESHOLDS};
