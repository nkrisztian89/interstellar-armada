#define MAX_LUMINOSITY_FACTORS 20

uniform float u_luminosityFactors[MAX_LUMINOSITY_FACTORS];

attribute float a_groupIndex;

varying lowp float v_luminosityFactor;