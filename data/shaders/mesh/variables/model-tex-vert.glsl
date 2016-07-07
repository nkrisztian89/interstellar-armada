uniform lowp vec4 u_originalFactionColor;
uniform lowp vec4 u_replacementFactionColor;

attribute mediump vec2 a_texCoord;
attribute lowp vec4 a_color;

varying mediump vec2 v_texCoord;
varying lowp vec4 v_color;

#include "conditionals.glsl"