import bpy
from bpy.props import (
    StringProperty,
)
from bpy_extras.io_utils import (
    ImportHelper,
)
from bpy.types import (
    Operator,
)

bl_info = {
    "name": "EgomModel import",
    "author": "Krisztián Nagy",
    "version": (1, 0, 0),
    "blender": (3, 5, 1),
    "location": "File > Import-Export",
    "description": "Adds support to import models in the EgomModel (.egm) file format, version 3.6",
    "category": "Import-Export",
    "support": "COMMUNITY",
}

# EGM group index values are multiplied by this factor to get vertex group
# weights
WEIGHT_FACTOR = 0.001


# Returns the blender material associated with the passed name
def get_material(name):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    if mat.node_tree:
        mat.node_tree.links.clear()
        mat.node_tree.nodes.clear()
    return mat


class ImportEGM(Operator, ImportHelper):

    bl_idname = "import_mesh.egm"
    bl_label = "Import EGM"
    bl_description = """Load mesh data from EgomModel format"""

    filename_ext = ".egm"
    filter_glob: StringProperty(default="*.egm", options={'HIDDEN'})

    def execute(self, context):
        import json

        # Parse JSON
        f = open(self.filepath)
        data = json.load(f)
        f.close()
        # Load metadata
        info = data['info']
        scale = info['scale']
        name = info['name']
        lodRange = info['LOD']
        minLOD = lodRange[0]
        maxLOD = lodRange[1]
        palette = info['colorPalette']
        materials = []
        # Create default 16x16 white texture
        im_width = 16
        im_height = 16
        image = bpy.data.images.new(name, im_width, im_height)
        image.pixels = [1.0] * (im_width * im_height * 4)
        image.update()
        # Create default 16x16 specular texture
        spec_image = bpy.data.images.new(name+"_spec", im_width, im_height)
        spec_image.pixels = [0.5] * (im_width * im_height * 4)
        spec_image.update()

        # Set up node group to use for materials
        nodeGroup = bpy.data.node_groups.new(name, 'ShaderNodeTree')
        nodes = nodeGroup.nodes
        links = nodeGroup.links
        nodeGroup.inputs.new('NodeSocketColor', 'Color')
        nodeGroup.outputs.new('NodeSocketColor', 'Color')
        nodeGroup.outputs.new('NodeSocketColor', 'Specular')
        inputs = nodes.new(type='NodeGroupInput')
        outputs = nodes.new(type='NodeGroupOutput')
        mix = nodes.new(type='ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Fac'].default_value = 1.0
        links.new(mix.outputs['Color'], outputs.inputs['Color'])
        tex = nodes.new(type='ShaderNodeTexImage')
        tex.image = image
        tex_spec = nodes.new(type='ShaderNodeTexImage')
        tex_spec.image = spec_image
        tex_coord = nodes.new(type='ShaderNodeTexCoord')
        links.new(tex.outputs['Color'], mix.inputs['Color2'])
        links.new(tex_spec.outputs['Color'], outputs.inputs['Specular'])
        links.new(tex_coord.outputs['UV'], tex.inputs['Vector'])
        links.new(tex_coord.outputs['UV'], tex_spec.inputs['Vector'])
        links.new(inputs.outputs['Color'], mix.inputs['Color1'])
        # Arrange nodes
        inputs.location = (-500, 400)
        tex_coord.location = (-500, 0)
        tex.location = (-300, 0)
        tex_spec.location = (-300, -400)
        mix.location = (0, 400)
        outputs.location = (200, 0)

        # Create a blender material for each color palette entry
        for i, color in enumerate(palette):
            mat = get_material(name+"_color"+str(i))
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            output = nodes.new(type='ShaderNodeOutputMaterial')
            shader = nodes.new(type='ShaderNodeBsdfPrincipled')
            shader.inputs['Base Color'].default_value = (color[0], color[1],
                                                         color[2], color[3])
            shader.inputs['Roughness'].default_value = 0.2
            shader.inputs['Alpha'].default_value = color[3]
            links.new(shader.outputs[0], output.inputs[0])
            g = nodes.new('ShaderNodeGroup')
            g.node_tree = nodeGroup
            g.inputs['Color'].default_value = (color[0], color[1],
                                               color[2], color[3])
            links.new(g.outputs['Color'], shader.inputs['Base Color'])
            links.new(g.outputs['Specular'], shader.inputs['Specular'])
            g.location = (-200, 0)
            shader.location = (0, 0)
            output.location = (300, 0)
            if color[3] < 1.0:
                mat.blend_method = 'BLEND'
            mat.use_backface_culling = True
            materials.append(mat)

        # Create a mesh for each level of detail
        for lod in range(minLOD, maxLOD+1):
            mesh = bpy.data.meshes.new(name+"_lod"+str(lod))
            for mat in materials:
                mesh.materials.append(mat)
            # Parse vertices
            verts = []
            prevMinLOD = minLOD
            prevMaxLOD = maxLOD
            for v in data['vertices']:
                if len(v) >= 5:
                    prevMinLOD = v[3]
                    prevMaxLOD = v[4]
                if prevMinLOD <= lod and prevMaxLOD >= lod:
                    verts.append((v[0], v[1], v[2]))
                else:
                    verts.append((0, 0, 0))
            # Parse edges (no longer saved separately in egm 3.6)
            edges = []
            # Parse faces
            faces = []
            prevMinLOD = minLOD
            prevMaxLOD = maxLOD
            normals = []
            prevNormals = []
            prevPoints = 3
            for t in data['polygons']:
                # Parse the first array containing vertex indices,
                # texture coords, colors, LOD limits
                offs = 1 if t[0][0] < 0 else 0
                points = -t[0][0] if offs else prevPoints
                prevPoints = points
                length = len(t[0])
                has_mat = (length-offs-points) % 2
                has_uv = 2*points if (length-offs-points-has_mat) > 2 else 0
                has_lod = 2 if (length-offs-points-has_mat-has_uv) >= 2 else 0
                if has_lod:
                    prevMinLOD = t[0][-2]
                    prevMaxLOD = t[0][-1]
                # Only add the face to the current mesh if it matches the LOD
                if prevMinLOD <= lod and prevMaxLOD >= lod:
                    indices = [t[0][offs]]
                    for i in range(offs+1, offs+points):
                        indices.append(t[0][offs]+t[0][i])
                    faces.append(tuple(indices))
                    # Set normals (from second array if given)
                    if len(t) < 2 or len(t[1]) < 3:
                        for i in range(points):
                            normals.append([prevNormals[i][0],
                                            prevNormals[i][1],
                                            prevNormals[i][2]])
                    elif len(t[1]) < 3*points:
                        for i in range(points):
                            normals.append([t[1][0], t[1][1], t[1][2]])
                    else:
                        for i in range(points):
                            normals.append([t[1][i*3],
                                            t[1][i*3+1],
                                            t[1][i*3+2]])
                # Parse second array containing normals
                if len(t) > 1 and len(t[1]) > 2:
                    prevNormals = []
                    if len(t[1]) < 3*points:
                        for i in range(points):
                            prevNormals.append([t[1][0], t[1][1], t[1][2]])
                    else:
                        for i in range(points):
                            prevNormals.append([t[1][i*3],
                                                t[1][i*3+1],
                                                t[1][i*3+2]])
            mesh.from_pydata(verts, edges, faces)
            mesh.use_auto_smooth = True
            mesh.normals_split_custom_set(normals)
            # Set up UVs, material indices and group indices in a second pass
            i = 0
            prevMinLOD = minLOD
            prevMaxLOD = maxLOD
            prevmat = 0
            prev_tra = 0
            prev_lum = 0
            mesh.uv_layers.new()
            uv_layer = mesh.uv_layers.active.data
            # Create the object for this LOD
            ob = bpy.data.objects.new(name+"_lod"+str(lod), mesh)
            tra_group = ob.vertex_groups.new(name="transform")
            lum_group = ob.vertex_groups.new(name="luminosity")
            prevPoints = 3
            # A second pass on the polygons to fill face data
            for t in data['polygons']:
                if i >= len(mesh.polygons):
                    break
                face = mesh.polygons[i]
                # Parse the properties of the polygon
                offs = 1 if t[0][0] < 0 else 0
                points = -t[0][0] if offs else prevPoints
                prevPoints = points
                length = len(t[0])
                has_mat = (length-offs-points) % 2
                has_uv = 2*points if (length-offs-points-has_mat) > 2 else 0
                has_lod = 2 if (length-offs-points-has_mat-has_uv) >= 2 else 0
                if has_lod:
                    prevMinLOD = t[0][-2]
                    prevMaxLOD = t[0][-1]
                if has_uv:
                    prevUv = []
                    start = offs + points + has_mat
                    for ix in range(points):
                        prevUv.append((t[0][start+ix*2], 1-t[0][start+ix*2+1]))
                if has_mat:
                    prevmat = t[0][offs+points]
                if len(t) > 1 and len(t[1]) % 3 == 2:
                    prev_tra = t[1][-2]
                    prev_lum = t[1][-1]
                # If the polygon exists in the current LOD, set properties
                if prevMinLOD <= lod and prevMaxLOD >= lod:
                    face.material_index = prevmat
                    for ix, loop in enumerate(face.loop_indices):
                        uv_layer[loop].uv = prevUv[ix]
                    if prev_tra > 0:
                        tra_group.add(face.vertices,
                                      prev_tra * WEIGHT_FACTOR,
                                      'REPLACE')
                    if prev_lum > 0:
                        lum_group.add(face.vertices,
                                      prev_lum * WEIGHT_FACTOR,
                                      'REPLACE')
                    i += 1
            # Set up final properties of the object and add to scene
            ob['minLOD'] = lod
            ob['maxLOD'] = lod
            bpy.context.scene.collection.objects.link(ob)
            ob.location = bpy.context.scene.cursor.location
            ob.scale = (scale, scale, scale)
            # Hide all the LODs except the highest
            if lod < maxLOD:
                ob.hide_set(True)
        return {'FINISHED'}

    def draw(self, context):
        pass


def menu_import(self, context):
    self.layout.operator(ImportEGM.bl_idname, text="EgomModel (.egm)")


classes = (
    ImportEGM,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.TOPBAR_MT_file_import.append(menu_import)


def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)
    bpy.types.TOPBAR_MT_file_import.remove(menu_import)


if __name__ == "__main__":
    register()
