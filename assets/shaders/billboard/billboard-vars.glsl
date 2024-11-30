// scene uniforms
uniform mat4 u_viewProjMatrix;
uniform vec3 u_eyePos;

// vertex attributes
attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

// instance uniforms
uniform vec4 u_position; // 4th coordinate marks the size
uniform vec4 u_direction; // 4th coordinate marks the opacity

// varyings
varying mediump vec2 v_texCoord;
varying lowp float v_opacity;