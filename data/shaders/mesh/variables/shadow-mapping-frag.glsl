#define MAX_SHADOW_MAP_RANGES 6
#define MAX_SHADOW_MAPS 12

#define SHADOW_DISTANCE_FADEOUT_START 0.9
#define SHADOW_DISTANCE_FADEOUT_FACTOR 1.0 / (1.0 - SHADOW_DISTANCE_FADEOUT_START)

#define DEPTH_ERROR_TOLERANCE 0.0035
#define INDEX_ERROR_TOLERANCE 0.00195 

#define NUM_SHADOW_MAP_SAMPLES 9

uniform sampler2D u_shadowMaps[MAX_SHADOW_MAPS];
uniform bool u_shadows;
uniform float u_shadowMapRanges[MAX_SHADOW_MAP_RANGES];
uniform int u_numRanges;
uniform float u_shadowMapDepthRatio;
uniform float u_shadowMapTextureSize;
uniform vec2 u_shadowMapSampleOffsets[NUM_SHADOW_MAP_SAMPLES];

varying vec2 v_index;

varying vec4 v_shadowMapPosition[MAX_DIR_LIGHTS];