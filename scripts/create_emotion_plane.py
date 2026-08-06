import bpy
import math

def create_emotion_plane(
    plane_name="Forehead_Shadow_Plane",
    material_name="mat_forehead_shadow",
    plane_type="forehead",
    target_armature_name=None,
    head_bone_name="頭"
):
    """
    Creates an emotion plane mesh (Forehead Shadow or Cheek Blush) in Blender for Firefly model in Viera.
    Automatically assigns material, UVs, and binds vertex weights to the head bone ('頭' or 'head').
    """
    print(f"Creating emotion plane: {plane_name} (Type: {plane_type})...")

    # Deselect all
    bpy.ops.object.select_all(action='DESELECT')

    # Position & Size defaults based on PMX scale (Firefly standard height ~1.65m)
    if plane_type == "forehead":
        # Forehead shadow positioning (centered above eyes, in front of forehead)
        loc = (0.0, 0.10, 1.48)
        scale = (0.18, 0.12, 1.0) # Width x Height
        rot = (math.radians(10), 0, 0)
    elif plane_type == "cheek_left":
        loc = (-0.08, 0.12, 1.35)
        scale = (0.07, 0.05, 1.0)
        rot = (math.radians(5), math.radians(-15), 0)
    elif plane_type == "cheek_right":
        loc = (0.08, 0.12, 1.35)
        scale = (0.07, 0.05, 1.0)
        rot = (math.radians(5), math.radians(15), 0)
    else:
        loc = (0.0, 0.10, 1.45)
        scale = (0.15, 0.15, 1.0)
        rot = (0, 0, 0)

    # 1. Create Mesh & Object
    mesh = bpy.data.meshes.new(plane_name + "_Mesh")
    obj = bpy.data.objects.new(plane_name, mesh)

    # Link to active collection
    collection = bpy.context.collection
    collection.objects.link(obj)

    # Set as active & selected
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Define Plane Vertices & UVs (Facing +Y axis, local XY plane)
    half_w = scale[0] / 2.0
    half_h = scale[1] / 2.0

    verts = [
        (-half_w, 0.0, -half_h), # Bottom-Left
        ( half_w, 0.0, -half_h), # Bottom-Right
        ( half_w, 0.0,  half_h), # Top-Right
        (-half_w, 0.0,  half_h)  # Top-Left
    ]
    faces = [(0, 1, 2, 3)]

    mesh.from_pydata(verts, [], faces)
    mesh.update()

    # Position and rotate object in 3D space
    obj.location = loc
    obj.rotation_euler = rot

    # 2. Add UV Map
    uv_layer = mesh.uv_layers.new(name="UVMap")
    uv_coords = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    for loop_idx, loop in enumerate(mesh.loops):
        uv_layer.data[loop_idx].uv = uv_coords[loop.vertex_index]

    # 3. Create or Assign Material
    mat = bpy.data.materials.get(material_name)
    if not mat:
        mat = bpy.data.materials.new(name=material_name)
        bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
        if bsdf:
            # Set surface properties suitable for anime emotion plane
            if 'Alpha' in bsdf.inputs:
                bsdf.inputs['Alpha'].default_value = 0.9
            if 'Base Color' in bsdf.inputs:
                if "shadow" in material_name.lower():
                    bsdf.inputs['Base Color'].default_value = (0.05, 0.08, 0.2, 1.0)
                else:
                    bsdf.inputs['Base Color'].default_value = (1.0, 0.45, 0.55, 1.0)
        # Transparency settings
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'BLEND'
        if hasattr(mat, 'shadow_method'):
            mat.shadow_method = 'NONE'

    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

    # 4. Attach to Armature & Head Bone if available
    armature_obj = None
    if target_armature_name:
        armature_obj = bpy.data.objects.get(target_armature_name)
    else:
        # Auto-detect armature in scene
        for o in bpy.data.objects:
            if o.type == 'ARMATURE':
                armature_obj = o
                break

    if armature_obj:
        # Check bone existence
        found_head_bone = None
        for bone in armature_obj.data.bones:
            if bone.name == head_bone_name or bone.name.lower() in ['head', '頭', 'atama']:
                found_head_bone = bone.name
                break

        if found_head_bone:
            # Create Vertex Group for Head Bone
            vgroup = obj.vertex_groups.new(name=found_head_bone)
            vgroup.add([0, 1, 2, 3], 1.0, 'REPLACE')

            # Add Armature Modifier
            mod = obj.modifiers.new(name="Armature", type='ARMATURE')
            mod.object = armature_obj
            print(f"Bound {plane_name} to Armature '{armature_obj.name}' bone '{found_head_bone}'!")
        else:
            print(f"Armature found, but head bone ('{head_bone_name}' / 'head') not found. Vertex group created for '{head_bone_name}'.")

    print(f"Successfully created emotion plane '{plane_name}'!")
    return obj

if __name__ == "__main__":
    create_emotion_plane(plane_name="Forehead_Shadow_Plane", material_name="mat_forehead_shadow", plane_type="forehead")
