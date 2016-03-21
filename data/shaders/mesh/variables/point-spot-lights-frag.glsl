#define MAX_POINT_LIGHTS 128
#define MAX_SPOT_LIGHTS 7

struct PointLight
    {
        vec4 color; // RGB color and intensity
        vec3 position; // position
    };

struct SpotLight
    {
        vec4 color; // RGB color and intensity
        vec4 spot; // spot direction XYZ and cutoff angle cosine
        vec4 position; // position and full intensity angle cosine
    };

uniform PointLight u_pointLights[MAX_POINT_LIGHTS];
uniform int u_numPointLights;
uniform SpotLight u_spotLights[MAX_SPOT_LIGHTS];
uniform int u_numSpotLights;

varying vec4 v_worldPos;