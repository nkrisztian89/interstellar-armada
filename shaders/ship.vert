// shader used for spaceships

precision mediump float;

// uniforms set for the whole model
uniform mat4 u_modelMatrix;
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;
uniform mat3 u_normalMatrix;
// uniforms that set for each group of the model
uniform float u_luminosityFactors[20]; // the luminosity texture will be multiplied by this number

attribute vec3 a_position;
attribute vec2 a_texCoord;
attribute vec3 a_normal;
attribute vec4 a_color;
attribute float a_luminosity;
attribute float a_shininess;
attribute float a_groupIndex;
	
varying vec3 v_position;
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;
varying float v_luminosityFactor;

varying vec4 v_worldPos;


void main() {
	gl_Position = u_projMatrix * u_cameraMatrix * u_modelMatrix * vec4(a_position,1.0);
	
        v_position = a_position;
	v_texCoord = a_texCoord;
	v_normal = normalize(u_normalMatrix * a_normal);
	v_color = a_color;
	v_luminosity = a_luminosity;
	v_shininess = a_shininess;
        v_luminosityFactor = u_luminosityFactors[int(a_groupIndex)];
	
	v_worldPos = u_modelMatrix * vec4(a_position,1.0);
}
