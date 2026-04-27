// src / components / charts / WorldMap.js
import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useSelector } from 'react-redux';
import { formatNumber } from '../../utils/formatters';
import { colorScales } from '../../constants/colorScales';
import '../../styles/components/charts.css';

const AIRPORT_MARKERS = [
  {
    id: 'icn',
    name: 'Incheon International Airport',
    city: 'Incheon',
    country: 'South Korea',
    iata: 'ICN',
    lat: 37.4602,
    lng: 126.4407,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Korean_Air_A380-800_HL7611.jpg'
  },
  {
    id: 'jfk',
    name: 'John F. Kennedy International Airport',
    city: 'New York',
    country: 'United States',
    iata: 'JFK',
    lat: 40.6413,
    lng: -73.7781,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Delta_Air_Lines_Boeing_767-332%28ER%29_N190DN.jpg'
  },
  {
    id: 'lhr',
    name: 'Heathrow Airport',
    city: 'London',
    country: 'United Kingdom',
    iata: 'LHR',
    lat: 51.47,
    lng: -0.4543,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/British_Airways_Boeing_787-9_Dreamliner_G-ZBKC.jpg'
  },
  {
    id: 'hnd',
    name: 'Haneda Airport',
    city: 'Tokyo',
    country: 'Japan',
    iata: 'HND',
    lat: 35.5494,
    lng: 139.7798,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/All_Nippon_Airways_Boeing_787-8_JA804A.jpg'
  },
  {
    id: 'cdg',
    name: 'Charles de Gaulle Airport',
    city: 'Paris',
    country: 'France',
    iata: 'CDG',
    lat: 49.0097,
    lng: 2.5479,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Air_France_Boeing_777-328ER_F-GSQO.jpg'
  },
  {
    id: 'dxb',
    name: 'Dubai International Airport',
    city: 'Dubai',
    country: 'UAE',
    iata: 'DXB',
    lat: 25.2532,
    lng: 55.3657,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Emirates_Airbus_A380_A6-EDB.jpg'
  },
  {
    id: 'sin',
    name: 'Singapore Changi Airport',
    city: 'Singapore',
    country: 'Singapore',
    iata: 'SIN',
    lat: 1.3644,
    lng: 103.9915,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Singapore_Airlines_Airbus_A350-900_9V-SMU.jpg'
  },
  {
    id: 'fra',
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    country: 'Germany',
    iata: 'FRA',
    lat: 50.0379,
    lng: 8.5622,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Lufthansa_Airbus_A350-900_D-AIXC.jpg'
  },
  {
    id: 'ams',
    name: 'Amsterdam Schiphol Airport',
    city: 'Amsterdam',
    country: 'Netherlands',
    iata: 'AMS',
    lat: 52.31,
    lng: 4.7683,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/KLM_Boeing_787-9_PH-BHF.jpg'
  },
  {
    id: 'mad',
    name: 'Adolfo Suarez Madrid-Barajas Airport',
    city: 'Madrid',
    country: 'Spain',
    iata: 'MAD',
    lat: 40.4983,
    lng: -3.5676,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Iberia_Airbus_A350-900_EC-NBE.jpg'
  },
  {
    id: 'fco',
    name: 'Leonardo da Vinci-Fiumicino Airport',
    city: 'Rome',
    country: 'Italy',
    iata: 'FCO',
    lat: 41.8003,
    lng: 12.2389,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/ITA_Airways_Airbus_A350-900_EI-IFA.jpg'
  },
  {
    id: 'ist',
    name: 'Istanbul Airport',
    city: 'Istanbul',
    country: 'Turkey',
    iata: 'IST',
    lat: 41.2753,
    lng: 28.7519,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/83/Turkish_Airlines_Airbus_A350-900_TC-LGA.jpg'
  },
  {
    id: 'del',
    name: 'Indira Gandhi International Airport',
    city: 'Delhi',
    country: 'India',
    iata: 'DEL',
    lat: 28.5562,
    lng: 77.1,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Air_India_Boeing_787-8_VT-ANE.jpg'
  },
  {
    id: 'bom',
    name: 'Chhatrapati Shivaji Maharaj International Airport',
    city: 'Mumbai',
    country: 'India',
    iata: 'BOM',
    lat: 19.0896,
    lng: 72.8656,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Vistara_Airbus_A321neo_VT-TVA.jpg'
  },
  {
    id: 'pek',
    name: 'Beijing Capital International Airport',
    city: 'Beijing',
    country: 'China',
    iata: 'PEK',
    lat: 40.0799,
    lng: 116.6031,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Air_China_Boeing_747-8I_B-2485.jpg'
  },
  {
    id: 'pvg',
    name: 'Shanghai Pudong International Airport',
    city: 'Shanghai',
    country: 'China',
    iata: 'PVG',
    lat: 31.1443,
    lng: 121.8083,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/China_Eastern_Airlines_Airbus_A350-900_B-304V.jpg'
  },
  {
    id: 'can',
    name: 'Guangzhou Baiyun International Airport',
    city: 'Guangzhou',
    country: 'China',
    iata: 'CAN',
    lat: 23.3924,
    lng: 113.2988,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/China_Eastern_Airlines_Airbus_A350-900_B-304V.jpg'
  },
  {
    id: 'szx',
    name: "Shenzhen Bao'an International Airport",
    city: 'Shenzhen',
    country: 'China',
    iata: 'SZX',
    lat: 22.6393,
    lng: 113.8107,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/China_Eastern_Airlines_Airbus_A350-900_B-304V.jpg'
  },
  {
    id: 'ctu',
    name: 'Chengdu Tianfu International Airport',
    city: 'Chengdu',
    country: 'China',
    iata: 'TFU',
    lat: 30.312,
    lng: 104.4417,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/China_Eastern_Airlines_Airbus_A350-900_B-304V.jpg'
  },
  {
    id: 'xiy',
    name: "Xi'an Xianyang International Airport",
    city: "Xi'an",
    country: 'China',
    iata: 'XIY',
    lat: 34.4471,
    lng: 108.7516,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/China_Eastern_Airlines_Airbus_A350-900_B-304V.jpg'
  },
  {
    id: 'wuh',
    name: 'Wuhan Tianhe International Airport',
    city: 'Wuhan',
    country: 'China',
    iata: 'WUH',
    lat: 30.7838,
    lng: 114.2081,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/China_Eastern_Airlines_Airbus_A350-900_B-304V.jpg'
  },
  {
    id: 'hkg',
    name: 'Hong Kong International Airport',
    city: 'Hong Kong',
    country: 'Hong Kong',
    iata: 'HKG',
    lat: 22.308,
    lng: 113.9185,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Cathay_Pacific_Airbus_A350-900_B-LRA.jpg'
  },
  {
    id: 'bkk',
    name: 'Suvarnabhumi Airport',
    city: 'Bangkok',
    country: 'Thailand',
    iata: 'BKK',
    lat: 13.69,
    lng: 100.7501,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Thai_Airways_Boeing_777-300ER_HS-TKO.jpg'
  },
  {
    id: 'syd',
    name: 'Sydney Airport',
    city: 'Sydney',
    country: 'Australia',
    iata: 'SYD',
    lat: -33.9399,
    lng: 151.1753,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Qantas_Boeing_787-9_Dreamliner_VH-ZNC.jpg'
  },
  {
    id: 'mel',
    name: 'Melbourne Airport',
    city: 'Melbourne',
    country: 'Australia',
    iata: 'MEL',
    lat: -37.669,
    lng: 144.841,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Virgin_Australia_Boeing_737-8FE_VH-YIE.jpg'
  },
  {
    id: 'akl',
    name: 'Auckland Airport',
    city: 'Auckland',
    country: 'New Zealand',
    iata: 'AKL',
    lat: -37.0082,
    lng: 174.785,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Air_New_Zealand_Boeing_787-9_ZK-NZH.jpg'
  },
  {
    id: 'gru',
    name: 'Sao Paulo/Guarulhos International Airport',
    city: 'Sao Paulo',
    country: 'Brazil',
    iata: 'GRU',
    lat: -23.4356,
    lng: -46.4731,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/LATAM_Brazil_Boeing_777-32WER_PT-MUG.jpg'
  },
  {
    id: 'eze',
    name: 'Ministro Pistarini International Airport',
    city: 'Buenos Aires',
    country: 'Argentina',
    iata: 'EZE',
    lat: -34.8222,
    lng: -58.5358,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/59/Aerolineas_Argentinas_Boeing_737-8SH_LV-FSK.jpg'
  },
  {
    id: 'scl',
    name: 'Arturo Merino Benitez International Airport',
    city: 'Santiago',
    country: 'Chile',
    iata: 'SCL',
    lat: -33.3929,
    lng: -70.7858,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/LATAM_Airlines_Chile_Boeing_787-9_CC-BGG.jpg'
  },
  {
    id: 'jnb',
    name: 'O. R. Tambo International Airport',
    city: 'Johannesburg',
    country: 'South Africa',
    iata: 'JNB',
    lat: -26.1337,
    lng: 28.242,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2d/South_African_Airways_Airbus_A340-313_ZS-SXD.jpg'
  },
  {
    id: 'cpt',
    name: 'Cape Town International Airport',
    city: 'Cape Town',
    country: 'South Africa',
    iata: 'CPT',
    lat: -33.9696,
    lng: 18.5972,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e2/FlySafair_Boeing_737-8KN_ZS-SJH.jpg'
  },
  {
    id: 'cai',
    name: 'Cairo International Airport',
    city: 'Cairo',
    country: 'Egypt',
    iata: 'CAI',
    lat: 30.1219,
    lng: 31.4056,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/27/EgyptAir_Boeing_787-9_SU-GFK.jpg'
  },
  {
    id: 'add',
    name: 'Addis Ababa Bole International Airport',
    city: 'Addis Ababa',
    country: 'Ethiopia',
    iata: 'ADD',
    lat: 8.9779,
    lng: 38.7993,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'mex',
    name: 'Mexico City International Airport',
    city: 'Mexico City',
    country: 'Mexico',
    iata: 'MEX',
    lat: 19.4361,
    lng: -99.0719,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Aeromexico_Boeing_787-9_N183AM.jpg'
  },
  {
    id: 'yyz',
    name: 'Toronto Pearson International Airport',
    city: 'Toronto',
    country: 'Canada',
    iata: 'YYZ',
    lat: 43.6777,
    lng: -79.6248,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Air_Canada_Boeing_787-9_C-FRSE.jpg'
  },
  {
    id: 'lax',
    name: 'Los Angeles International Airport',
    city: 'Los Angeles',
    country: 'United States',
    iata: 'LAX',
    lat: 33.9416,
    lng: -118.4085,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/United_Airlines_Boeing_777-222ER_N78001.jpg'
  },
  {
    id: 'sfo',
    name: 'San Francisco International Airport',
    city: 'San Francisco',
    country: 'United States',
    iata: 'SFO',
    lat: 37.6213,
    lng: -122.379,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Alaska_Airlines_Boeing_737-9_MAX_N915AK.jpg'
  },
  {
    id: 'mia',
    name: 'Miami International Airport',
    city: 'Miami',
    country: 'United States',
    iata: 'MIA',
    lat: 25.7959,
    lng: -80.287,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/44/American_Airlines_Boeing_777-223ER_N791AN.jpg'
  },
  {
    id: 'sea',
    name: 'Seattle-Tacoma International Airport',
    city: 'Seattle',
    country: 'United States',
    iata: 'SEA',
    lat: 47.4502,
    lng: -122.3088,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Delta_Air_Lines_Airbus_A330-323_N809NW.jpg'
  },
  {
    id: 'doh',
    name: 'Hamad International Airport',
    city: 'Doha',
    country: 'Qatar',
    iata: 'DOH',
    lat: 25.2731,
    lng: 51.6081,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Qatar_Airways_Boeing_787-8_A7-BCF.jpg'
  },
  {
    id: 'auh',
    name: 'Abu Dhabi International Airport',
    city: 'Abu Dhabi',
    country: 'UAE',
    iata: 'AUH',
    lat: 24.433,
    lng: 54.6511,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Etihad_Airways_Boeing_787-9_A6-BLH.jpg'
  },
  {
    id: 'ruh',
    name: 'King Khalid International Airport',
    city: 'Riyadh',
    country: 'Saudi Arabia',
    iata: 'RUH',
    lat: 24.9576,
    lng: 46.6988,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Saudia_Boeing_787-10_HZ-AR24.jpg'
  },
  {
    id: 'hel',
    name: 'Helsinki Airport',
    city: 'Helsinki',
    country: 'Finland',
    iata: 'HEL',
    lat: 60.3172,
    lng: 24.9633,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Finnair_Airbus_A350-900_OH-LWA.jpg'
  },
  {
    id: 'atl',
    name: 'Hartsfield-Jackson Atlanta International Airport',
    city: 'Atlanta',
    country: 'United States',
    iata: 'ATL',
    lat: 33.6407,
    lng: -84.4277,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Delta_Air_Lines_Boeing_767-332%28ER%29_N190DN.jpg'
  },
  {
    id: 'ord',
    name: "O'Hare International Airport",
    city: 'Chicago',
    country: 'United States',
    iata: 'ORD',
    lat: 41.9742,
    lng: -87.9073,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/United_Airlines_Boeing_777-222ER_N78001.jpg'
  },
  {
    id: 'dfw',
    name: 'Dallas/Fort Worth International Airport',
    city: 'Dallas',
    country: 'United States',
    iata: 'DFW',
    lat: 32.8998,
    lng: -97.0403,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/44/American_Airlines_Boeing_777-223ER_N791AN.jpg'
  },
  {
    id: 'iad',
    name: 'Washington Dulles International Airport',
    city: 'Washington',
    country: 'United States',
    iata: 'IAD',
    lat: 38.9531,
    lng: -77.4565,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/United_Airlines_Boeing_777-222ER_N78001.jpg'
  },
  {
    id: 'svo',
    name: 'Sheremetyevo International Airport',
    city: 'Moscow',
    country: 'Russia',
    iata: 'SVO',
    lat: 55.9726,
    lng: 37.4146,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Aeroflot_Airbus_A350-900_VP-BXT.jpg'
  },
  {
    id: 'dme',
    name: 'Domodedovo International Airport',
    city: 'Moscow',
    country: 'Russia',
    iata: 'DME',
    lat: 55.4088,
    lng: 37.9063,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Aeroflot_Airbus_A350-900_VP-BXT.jpg'
  },
  {
    id: 'led',
    name: 'Pulkovo Airport',
    city: 'Saint Petersburg',
    country: 'Russia',
    iata: 'LED',
    lat: 59.8003,
    lng: 30.2625,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Rossiya_Airlines_Airbus_A319-111_VQ-BAS.jpg'
  },
  {
    id: 'vko',
    name: 'Vnukovo International Airport',
    city: 'Moscow',
    country: 'Russia',
    iata: 'VKO',
    lat: 55.5915,
    lng: 37.2615,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Aeroflot_Airbus_A350-900_VP-BXT.jpg'
  },
  {
    id: 'gru2',
    name: 'Brasilia International Airport',
    city: 'Brasilia',
    country: 'Brazil',
    iata: 'BSB',
    lat: -15.8692,
    lng: -47.9208,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/LATAM_Brazil_Boeing_777-32WER_PT-MUG.jpg'
  },
  {
    id: 'yvr',
    name: 'Vancouver International Airport',
    city: 'Vancouver',
    country: 'Canada',
    iata: 'YVR',
    lat: 49.1951,
    lng: -123.1779,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Air_Canada_Boeing_787-9_C-FRSE.jpg'
  },
  {
    id: 'yul',
    name: 'Montreal-Trudeau International Airport',
    city: 'Montreal',
    country: 'Canada',
    iata: 'YUL',
    lat: 45.4706,
    lng: -73.7408,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Air_Canada_Boeing_787-9_C-FRSE.jpg'
  },
  {
    id: 'yyc',
    name: 'Calgary International Airport',
    city: 'Calgary',
    country: 'Canada',
    iata: 'YYC',
    lat: 51.1139,
    lng: -114.02,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Air_Canada_Boeing_787-9_C-FRSE.jpg'
  },
  {
    id: 'yeg',
    name: 'Edmonton International Airport',
    city: 'Edmonton',
    country: 'Canada',
    iata: 'YEG',
    lat: 53.3097,
    lng: -113.58,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Air_Canada_Boeing_787-9_C-FRSE.jpg'
  },
  {
    id: 'ovb',
    name: 'Novosibirsk Tolmachevo Airport',
    city: 'Novosibirsk',
    country: 'Russia',
    iata: 'OVB',
    lat: 55.0126,
    lng: 82.6507,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Aeroflot_Airbus_A350-900_VP-BXT.jpg'
  },
  {
    id: 'svx',
    name: 'Koltsovo Airport',
    city: 'Yekaterinburg',
    country: 'Russia',
    iata: 'SVX',
    lat: 56.7431,
    lng: 60.8027,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Rossiya_Airlines_Airbus_A319-111_VQ-BAS.jpg'
  },
  {
    id: 'kuf',
    name: 'Kurumoch International Airport',
    city: 'Samara',
    country: 'Russia',
    iata: 'KUF',
    lat: 53.5049,
    lng: 50.1643,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Rossiya_Airlines_Airbus_A319-111_VQ-BAS.jpg'
  },
  {
    id: 'aer',
    name: 'Sochi International Airport',
    city: 'Sochi',
    country: 'Russia',
    iata: 'AER',
    lat: 43.4499,
    lng: 39.9566,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Rossiya_Airlines_Airbus_A319-111_VQ-BAS.jpg'
  },
  {
    id: 'kzn',
    name: 'Kazan International Airport',
    city: 'Kazan',
    country: 'Russia',
    iata: 'KZN',
    lat: 55.6062,
    lng: 49.2787,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Rossiya_Airlines_Airbus_A319-111_VQ-BAS.jpg'
  },
  {
    id: 'dkr',
    name: 'Blaise Diagne International Airport',
    city: 'Dakar',
    country: 'Senegal',
    iata: 'DSS',
    lat: 14.67,
    lng: -17.0733,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'los',
    name: 'Murtala Muhammed International Airport',
    city: 'Lagos',
    country: 'Nigeria',
    iata: 'LOS',
    lat: 6.5774,
    lng: 3.3212,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'acc',
    name: 'Kotoka International Airport',
    city: 'Accra',
    country: 'Ghana',
    iata: 'ACC',
    lat: 5.6052,
    lng: -0.1668,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'nbo',
    name: 'Jomo Kenyatta International Airport',
    city: 'Nairobi',
    country: 'Kenya',
    iata: 'NBO',
    lat: -1.3192,
    lng: 36.9278,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'cmn',
    name: 'Mohammed V International Airport',
    city: 'Casablanca',
    country: 'Morocco',
    iata: 'CMN',
    lat: 33.3675,
    lng: -7.5899,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'alg',
    name: 'Houari Boumediene Airport',
    city: 'Algiers',
    country: 'Algeria',
    iata: 'ALG',
    lat: 36.691,
    lng: 3.2154,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'tun',
    name: 'Tunis-Carthage International Airport',
    city: 'Tunis',
    country: 'Tunisia',
    iata: 'TUN',
    lat: 36.851,
    lng: 10.2272,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'dar',
    name: 'Julius Nyerere International Airport',
    city: 'Dar es Salaam',
    country: 'Tanzania',
    iata: 'DAR',
    lat: -6.8781,
    lng: 39.2026,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'fih',
    name: "N'djili Airport",
    city: 'Kinshasa',
    country: 'DR Congo',
    iata: 'FIH',
    lat: -4.3858,
    lng: 15.4446,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'abj',
    name: 'Felix-Houphouet-Boigny International Airport',
    city: 'Abidjan',
    country: 'Cote dIvoire',
    iata: 'ABJ',
    lat: 5.2614,
    lng: -3.9263,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'wdh',
    name: 'Hosea Kutako International Airport',
    city: 'Windhoek',
    country: 'Namibia',
    iata: 'WDH',
    lat: -22.4799,
    lng: 17.4709,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  },
  {
    id: 'kgl',
    name: 'Kigali International Airport',
    city: 'Kigali',
    country: 'Rwanda',
    iata: 'KGL',
    lat: -1.9686,
    lng: 30.1395,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ethiopian_Airlines_Boeing_787-8_ET-ASH.jpg'
  }
];

const formatCompactMetric = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${Math.round(value)}`;
};

const getPer100kValue = (countryData, metricKey) => {
  if (!countryData) return 0;
  const metricValue = Number(countryData[metricKey]);
  const populationValue = Number(countryData.population);
  if (!Number.isFinite(metricValue) || metricValue <= 0) return 0;
  if (!Number.isFinite(populationValue) || populationValue <= 0) return 0;
  return (metricValue / populationValue) * 100000;
};

const COUNTRY_SHORT_NAME_MAP = {
  'United States of America': 'USA',
  'United Kingdom': 'UK',
  'United Arab Emirates': 'UAE',
  'Russian Federation': 'Russia',
  'Democratic Republic of the Congo': 'DR Congo',
  'Central African Republic': 'CAR',
  'Bosnia and Herzegovina': 'Bosnia',
  'Dominican Republic': 'Dominican Rep.',
  'Papua New Guinea': 'Papua N.G.',
  'Trinidad and Tobago': 'Trinidad'
};

const getCountryName = (feature) => {
  const properties = feature?.properties || {};
  return (
    properties.name ||
    properties.ADMIN ||
    properties.NAME ||
    properties.NAME_EN ||
    properties.SOVEREIGNT ||
    'Unknown'
  );
};

const getShortCountryName = (countryName) => {
  const mappedName = COUNTRY_SHORT_NAME_MAP[countryName] || countryName;
  if (mappedName.length <= 14) return mappedName;
  return `${mappedName.slice(0, 13)}.`;
};

const WorldMap = ({
  data,
  width = 960,
  height = 500,
  margin = { top: 10, right: 10, bottom: 10, left: 10 },
  metric = 'cases',
  colorRange = colorScales?.cases || ['#f7fbff', '#08519c'], // Add fallback colors
  onCountryClick = () => { },
  focusCountry = null
}) => {
  const mapRef = useRef();
  const tooltipRef = useRef();
  const [worldData, setWorldData] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const theme = useSelector(state => state.ui.theme);

  const filteredWorldData = useMemo(() => {
    if (!worldData?.features) return null;

    const focusName = String(focusCountry || '').toLowerCase();
    const isGlobalFocus = !focusName || focusName === 'global' || focusName === 'all';

    let focusIso3 = '';
    if (Array.isArray(data) && !isGlobalFocus) {
      const focusedCountryData = data.find((country) => {
        const countryName = String(country?.country || '').toLowerCase();
        const iso2 = String(country?.countryInfo?.iso2 || '').toLowerCase();
        const iso3 = String(country?.countryInfo?.iso3 || '').toLowerCase();
        return countryName === focusName || iso2 === focusName || iso3 === focusName;
      });
      focusIso3 = String(focusedCountryData?.countryInfo?.iso3 || '').toUpperCase();
    }

    const countryFiltered = worldData.features.filter((feature) => {
      const properties = feature?.properties || {};
      const countryName = String(properties.ADMIN || properties.name || properties.NAME || '').toLowerCase();
      const iso3 = String(properties.ISO_A3 || properties.iso_a3 || '').toUpperCase();
      const isAntarctica = countryName === 'antarctica' || iso3 === 'ATA';
      if (isAntarctica) return false;

      if (isGlobalFocus) return true;
      if (focusIso3) return iso3 === focusIso3;

      // Fallback matching for name-based selections when ISO code is unavailable
      if (countryName === focusName) return true;
      if (focusName === 'south korea' || focusName === 's. korea' || focusName === 'korea' || focusName === 'kr') {
        return iso3 === 'KOR' || countryName.includes('korea');
      }
      return countryName.includes(focusName);
    });

    return {
      ...worldData,
      features: countryFiltered
    };
  }, [worldData, focusCountry, data]);

  // Fetch world geometry data
  useEffect(() => {
    setIsLoading(true);
    fetch('/assets/world.geojson')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load geojson data');
        return response.json();
      })
      .then(geoData => {
        setWorldData(geoData);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading world map data:', error);
        setError(error.message);
        setIsLoading(false);
      });
  }, []);

  // Create memoized map configuration once worldData and data are available
  const mapConfig = useMemo(() => {
    if (!data || !filteredWorldData) return null;

    // Extract per-100k values for color scale
    let dataValues = [];
    if (Array.isArray(data)) {
      dataValues = data
        .map(d => getPer100kValue(d, metric))
        .filter(value => Number.isFinite(value) && value > 0);
    } else {
      dataValues = Object.values(data)
        .map(d => getPer100kValue(d, metric))
        .filter(value => Number.isFinite(value) && value > 0);
    }

    // Ensure we have data to display
    if (dataValues.length === 0) {
      return null;
    }

    // Low per-capita infection: green, high: red
    const colors = ['#2e7d32', '#c62828'];

    // Create color scale based on data range
    const colorScale = d3.scaleSequential()
      .domain([0, d3.max(dataValues) || 0])
      .interpolator(d3.interpolate(colors[0], colors[1]));

    // Set up projection with explicit padding so northern regions
    // like Greenland remain visible on initial render.
    const projectionTopPadding = 52;
    const projectionBottomPadding = 26;
    const projectionSidePadding = 12;
    const projection = d3.geoMercator()
      .fitExtent(
        [
          [margin.left + projectionSidePadding, margin.top + projectionTopPadding],
          [width - margin.right - projectionSidePadding, height - margin.bottom - projectionBottomPadding]
        ],
        filteredWorldData
      );

    const pathGenerator = d3.geoPath().projection(projection);

    return { colorScale, projection, pathGenerator };
  }, [data, filteredWorldData, width, height, margin, metric, colorRange]);

  useEffect(() => {
    if (!mapConfig || !filteredWorldData || !data) return;

    const svg = d3.select(mapRef.current);
    const tooltip = d3.select(tooltipRef.current);
    const { colorScale, pathGenerator, projection } = mapConfig;
    const focusName = String(focusCountry || '').toLowerCase();
    const isGlobalFocus = !focusName || focusName === 'global' || focusName === 'all';

    // Clear previous contents
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    // Create main group and attach zoom behavior
    const g = svg.append('g');
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    const countryLookup = (feature) => {
      const countryCode = feature.properties.iso_a3 || feature.properties.ISO_A3;
      if (data[countryCode]) return data[countryCode];
      if (Array.isArray(data)) {
        return data.find(c =>
          c.country === feature.properties.name ||
          c.countryInfo?.iso3 === countryCode
        );
      }
      return null;
    };

    // Draw each country
    g.selectAll('path')
      .data(filteredWorldData.features)
      .join('path')
      .attr('d', pathGenerator)
      .attr('class', 'country')
      .attr('fill', d => {
        const countryData = countryLookup(d);
        const per100kValue = getPer100kValue(countryData, metric);

        return per100kValue > 0
          ? colorScale(per100kValue)
          : theme === 'dark' ? '#2a2a2a' : '#ddd';
      })
      .attr('stroke', theme === 'dark' ? '#555' : '#fff')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        const countryData = countryLookup(d);
        const countryName = getCountryName(d);
        const per100kValue = getPer100kValue(countryData, metric);

        setSelectedCountry(countryName);
        d3.select(event.currentTarget)
          .attr('stroke', theme === 'dark' ? '#fff' : '#000')
          .attr('stroke-width', 1.5);

        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 28}px`)
          .html(`
            <strong>${countryName}</strong><br/>
            ${countryData ? `${metric}: ${formatNumber(countryData[metric] || 0)}<br/>per 100k: ${formatNumber(Math.round(per100kValue))}` : 'No data available'}
          `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 28}px`);
      })
      .on('mouseout', (event) => {
        setSelectedCountry(null);
        d3.select(event.currentTarget)
          .attr('stroke', theme === 'dark' ? '#555' : '#fff')
          .attr('stroke-width', 0.5);
        tooltip.style('opacity', 0);
      })
      .on('click', (event, d) => {
        const countryCode = d.properties.iso_a3 || d.properties.ISO_A3;
        const countryData = countryLookup(d);
        const countryName = getCountryName(d);

        if (countryData) {
          onCountryClick({
            ...countryData,
            countryCode,
            countryName
          });
        }
      });

    const labelColorScale = d3.scaleLinear()
      .domain(colorScale.domain())
      .range(['#2e7d32', '#c62828'])
      .clamp(true);

    const labelFeatures = filteredWorldData.features
      .map((feature) => {
        const countryData = countryLookup(feature);
        const metricValue = countryData?.[metric];
        const per100kValue = getPer100kValue(countryData, metric);
        if (!Number.isFinite(metricValue) || metricValue <= 0) return null;
        if (!Number.isFinite(per100kValue) || per100kValue <= 0) return null;
        const centroid = pathGenerator.centroid(feature);
        if (!Number.isFinite(centroid?.[0]) || !Number.isFinite(centroid?.[1])) return null;
        const countryName = getCountryName(feature);
        const shortCountryName = getShortCountryName(countryName);
        return {
          id: feature.properties.iso_a3 || feature.properties.ISO_A3 || countryName,
          x: centroid[0],
          y: centroid[1],
          value: metricValue,
          per100kValue,
          countryName: shortCountryName,
          label: `${shortCountryName} ${formatCompactMetric(metricValue)}`
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.value - a.value)
      .slice(0, 80);

    const selectedLabelFeatures = [];
    const labelBoxes = [];
    const minHorizontalGap = 10;
    const minVerticalGap = 8;

    labelFeatures.forEach((candidate) => {
      const estimatedWidth = Math.max(38, candidate.label.length * 5.5);
      const estimatedHeight = 12;
      const box = {
        left: candidate.x - estimatedWidth / 2,
        right: candidate.x + estimatedWidth / 2,
        top: candidate.y - estimatedHeight,
        bottom: candidate.y + 2
      };

      const overlaps = labelBoxes.some((existing) =>
        box.left < (existing.right + minHorizontalGap) &&
        box.right > (existing.left - minHorizontalGap) &&
        box.top < (existing.bottom + minVerticalGap) &&
        box.bottom > (existing.top - minVerticalGap)
      );

      if (!overlaps) {
        selectedLabelFeatures.push(candidate);
        labelBoxes.push(box);
      }
    });

    g.append('g')
      .attr('class', 'map-value-labels')
      .selectAll('text')
      .data(selectedLabelFeatures)
      .join('text')
      .attr('class', 'country-value-label')
      .attr('x', d => d.x)
      .attr('y', d => d.y - 4)
      .attr('text-anchor', 'middle')
      .attr('fill', d => labelColorScale(d.per100kValue))
      .text(d => d.label);

    if (isGlobalFocus) {
      const airportGroup = g.append('g').attr('class', 'airports-layer');
      const airportsWithPositions = AIRPORT_MARKERS.map((airport) => {
        const point = projection([airport.lng, airport.lat]);
        return {
          ...airport,
          x: point?.[0],
          y: point?.[1]
        };
      }).filter((airport) => Number.isFinite(airport.x) && Number.isFinite(airport.y));

      const airportMarkers = airportGroup
        .selectAll('g.airport-marker-group')
        .data(airportsWithPositions)
        .join('g')
        .attr('class', 'airport-marker-group')
        .attr('transform', d => `translate(${d.x},${d.y})`);

      airportMarkers.append('circle')
        .attr('class', 'airport-marker-halo')
        .attr('r', 5.5)
        .attr('fill', theme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.15)');

      airportMarkers.append('circle')
        .attr('class', 'airport-marker')
        .attr('r', 3.5)
        .attr('fill', '#ff7f50')
        .attr('stroke', theme === 'dark' ? '#fff' : '#111')
        .attr('stroke-width', 1.5)
        .on('mouseover', (event, d) => {
          tooltip
            .style('opacity', 1)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 28}px`)
            .html(`<strong>${d.iata}</strong><br/>${d.name}`);
        })
        .on('mousemove', (event) => {
          tooltip
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 28}px`);
        })
        .on('mouseout', () => {
          tooltip.style('opacity', 0);
        });
    }

    // Add a legend to display the color scale
    const legendWidth = 200;
    const legendHeight = 10;
    const legendX = width - legendWidth - 20;
    const legendY = height - 40;

    const legendScale = d3.scaleLinear()
      .domain(colorScale.domain())
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d => formatNumber(Math.round(d)));

    const defs = svg.append('defs');
    const linearGradient = defs.append('linearGradient')
      .attr('id', `linear-gradient-${metric}`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    linearGradient.selectAll('stop')
      .data([
        { offset: 0, color: '#2e7d32' },
        { offset: 1, color: '#c62828' }
      ])
      .join('stop')
      .attr('offset', d => `${d.offset * 100}%`)
      .attr('stop-color', d => d.color);

    svg.append('g')
      .attr('transform', `translate(${legendX}, ${legendY})`)
      .append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', `url(#linear-gradient-${metric})`);

    svg.append('g')
      .attr('transform', `translate(${legendX}, ${legendY + legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '10px')
      .attr('fill', theme === 'dark' ? '#ddd' : '#333');

    // Add a map title
    const metricTitleMap = {
      yesterdayCases: 'New Cases'
    };
    const metricTitle = metricTitleMap[metric] || `${metric.charAt(0).toUpperCase() + metric.slice(1)}`;

    svg.append('text')
      .attr('class', 'map-title')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .attr('fill', theme === 'dark' ? '#fff' : '#333')
      .text(`Pandemic ${metricTitle} by Country`);
  }, [data, width, height, margin, mapConfig, onCountryClick, theme, metric, colorRange, filteredWorldData, focusCountry]);

  if (isLoading) {
    return <div className="chart-loading">Loading map data...</div>;
  }

  if (error) {
    return <div className="chart-error">Error loading map: {error}</div>;
  }

  if (!filteredWorldData || !data) {
    return <div className="chart-placeholder">No data available</div>;
  }

  return (
    <div className="world-map-container">
      <svg ref={mapRef} className="world-map"></svg>
      <div ref={tooltipRef} className="chart-tooltip"></div>
    </div>
  );
};

export default React.memo(WorldMap);