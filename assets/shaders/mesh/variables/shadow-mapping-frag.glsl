#define SHADOW_MAP_TEXTURE_SIZE 1024.0

#define MAX_SHADOW_MAP_RANGES 6
#define MAX_SHADOW_MAPS 12

#define SHADOW_DISTANCE_FADEOUT_START 0.95
#define SHADOW_DISTANCE_FADEOUT_FACTOR 1.0 / (1.0 - SHADOW_DISTANCE_FADEOUT_START)

#define DEPTH_ERROR_TOLERANCE 0.00017

#define NUM_SHADOW_MAP_SAMPLES 9

#define SHADOW_MAP_DEPTH_RATIO 16.0

#define NORMAL_OFFSET_SCALE 2.0

#define DEPTH_TEXTURES 0

#include "mesh/variables/shadow-mapping-constants.glsl"

uniform highp sampler2D u_shadowMaps[MAX_SHADOW_MAPS];
uniform float u_shadowMapRanges[MAX_SHADOW_MAP_RANGES];
uniform vec2 u_shadowMapSampleOffsets[NUM_SHADOW_MAP_SAMPLES];

varying vec3 v_shadowMapPosition[MAX_DIR_LIGHTS];
varying vec3 v_shadowMapNormal[MAX_DIR_LIGHTS];
varying mat2 v_shadowMapSampleOffsetTransform[MAX_DIR_LIGHTS];
