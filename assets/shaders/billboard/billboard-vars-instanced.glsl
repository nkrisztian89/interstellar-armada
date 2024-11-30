// scene uniforms
uniform mat4 u_viewProjMatrix;
uniform vec3 u_eyePos;

// vertex attributes
attribute vec3 a_position;
attribute mediump vec2 a_texCoord;

// instance attributes
attribute vec4 i_position; // 4th coordinate marks the size
attribute vec4 i_direction; // 4th coordinate marks the opacity

// varyings
varying mediump vec2 v_texCoord;
varying lowp float v_opacity;