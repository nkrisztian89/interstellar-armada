uniform mat4 u_modelMatrix;
uniform mat4 u_lightMatrix;
uniform mat4 u_projMatrix;
uniform float u_shadowMapDepth;

attribute vec3 a_position;
attribute vec4 a_triangleIndex;

varying vec4 v_color;

void main() {
    gl_Position = u_lightMatrix * u_modelMatrix * vec4(a_position,1.0);
    float depth = 0.5+gl_Position.z/(2.0*u_shadowMapDepth);
    depth *= 256.0;
    gl_Position = u_projMatrix * gl_Position;
    v_color = vec4(a_triangleIndex.xy,fract(depth),floor(depth)/256.0);
}