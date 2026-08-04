using TMPro;
using UnityEngine;

namespace AXM.TextFabric
{
    [DisallowMultipleComponent]
    public sealed class AXMTextFxApplier : MonoBehaviour
    {
        [SerializeField] private TMP_Text target;
        [SerializeField] private AXMTextFxProfile profile;

        private void Reset() => target = GetComponent<TMP_Text>();

        [ContextMenu("Apply AXM Text FX")]
        public void Apply()
        {
            if (target == null || profile == null) return;
            var material = target.fontSharedMaterial != null
                ? new Material(target.fontSharedMaterial)
                : new Material(Shader.Find("TextMeshPro/Distance Field"));

            target.fontSharedMaterial = material;
            if (material.HasProperty("_FaceColor")) material.SetColor("_FaceColor", profile.BaseColor);
            if (material.HasProperty("_OutlineColor")) material.SetColor("_OutlineColor", profile.OutlineColor);
            if (material.HasProperty("_OutlineWidth")) material.SetFloat("_OutlineWidth", profile.OutlineWidth * 0.01f);
            if (material.HasProperty("_GlowColor")) material.SetColor("_GlowColor", profile.GlowColor);
            if (material.HasProperty("_GlowPower")) material.SetFloat("_GlowPower", profile.GlowPower);

            // AXM custom extension properties if your project shader exposes them.
            if (material.HasProperty("_AXMGlitchOffset")) material.SetFloat("_AXMGlitchOffset", profile.GlitchOffset);
            if (material.HasProperty("_AXMGlitchIntensity")) material.SetFloat("_AXMGlitchIntensity", profile.GlitchIntensity);
            if (material.HasProperty("_AXMGlitchRed")) material.SetColor("_AXMGlitchRed", profile.GlitchRed);
            if (material.HasProperty("_AXMGlitchCyan")) material.SetColor("_AXMGlitchCyan", profile.GlitchCyan);
            if (material.HasProperty("_AXMSheenOpacity")) material.SetFloat("_AXMSheenOpacity", profile.SheenOpacity);
            if (material.HasProperty("_AXMSheenAngle")) material.SetFloat("_AXMSheenAngle", profile.SheenAngle);
        }
    }
}
