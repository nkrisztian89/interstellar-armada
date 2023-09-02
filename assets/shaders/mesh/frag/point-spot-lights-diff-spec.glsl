    // handling dynamic point-like light sources
    highp vec3 direction;
    float intensity;
    highp float dist;
    highp float specDist;
    float viewDist = length(v_viewDir);
    for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
        if (i < u_numPointLights) {
            direction = u_pointLights[i].position - v_worldPos.xyz;
            dist = length(direction);
            direction = normalize(direction);
            specDist = dist + viewDist;
            float diffuseFactor = max(0.0, dot(direction, normal));
            float specularFactor = ifGreater(shininess, 0.0) * pow(max(dot(normal, normalize(direction - viewDir)), 0.0), shininess);
            intensity = u_pointLights[i].color.a;
            gl_FragColor.rgb += min(u_pointLights[i].color.rgb * diffuseFactor  * intensity / (dist * dist), 1.0) * diffuseColor.rgb
                              + min(u_pointLights[i].color.rgb * specularFactor * intensity / (specDist * specDist), 1.0) * texSpec.rgb;
        }
    }
    // handling spotlights
    float cutoffFactor;
    float cosine;
    for (int i = 0; i < MAX_SPOT_LIGHTS; i++) {
        if (i < u_numSpotLights) {
            direction = u_spotLights[i].position.xyz - v_worldPos.xyz;
            dist = length(direction);
            direction = normalize(direction);
            specDist = dist + viewDist;
            float diffuseFactor = max(0.0, dot(direction, normal));
            float specularFactor = ifGreater(shininess, 0.0) * pow(max(dot(normal, normalize(direction - viewDir)), 0.0), shininess);
            intensity = u_spotLights[i].color.a;
            cosine = dot(direction, -u_spotLights[i].spot.xyz);
            cutoffFactor = 1.0;
            if (cosine >= u_spotLights[i].spot.a) {
                if (u_spotLights[i].position.a > 0.0) {
                    cutoffFactor = clamp((cosine - u_spotLights[i].spot.a) / (u_spotLights[i].position.a - u_spotLights[i].spot.a), 0.0, 1.0);
                }
                gl_FragColor.rgb += min(u_spotLights[i].color.rgb * diffuseFactor  * intensity / (dist * dist), 1.0) * cutoffFactor * diffuseColor.rgb
                                  + min(u_spotLights[i].color.rgb * specularFactor * intensity / (specDist * specDist), 1.0) * cutoffFactor * texSpec.rgb;
            }
        }
    }