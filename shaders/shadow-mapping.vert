uniform mat4 u_modelMatrix;
uniform mat4 u_lightMatrix;
uniform mat4 u_projMatrix;
uniform float u_shadowMapRange;

attribute vec3 a_position;

varying vec3 v_color;

void main() {
    gl_Position = u_lightMatrix * u_modelMatrix * vec4(a_position,1.0);
    float brightness = 0.5+gl_Position.z/(2.0*u_shadowMapRange);
    gl_Position = u_projMatrix * gl_Position;
    v_color = vec3(brightness,brightness,brightness);
}