attribute vec4 a_index;

varying vec2 v_index;

varying vec3 v_shadowMapPosition[MAX_DIR_LIGHTS];
varying vec3 v_shadowMapNormal[MAX_DIR_LIGHTS];
varying mat2 v_shadowMapSampleOffsetTransform[MAX_DIR_LIGHTS];