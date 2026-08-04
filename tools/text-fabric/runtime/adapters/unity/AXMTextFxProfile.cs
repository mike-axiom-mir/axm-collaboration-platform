using System;
using UnityEngine;

namespace AXM.TextFabric
{
    [CreateAssetMenu(menuName = "AXM/Text FX Profile", fileName = "AXMTextFxProfile")]
    public sealed class AXMTextFxProfile : ScriptableObject
    {
        public string Recipe = "readable_glitch";
        public Color BaseColor = Color.white;
        public Color GradientTop = Color.white;
        public Color GradientMid = new Color(0.72f, 0.97f, 1f, 1f);
        public Color GradientBottom = new Color(0.84f, 0.80f, 1f, 1f);
        public Color OutlineColor = new Color(0.7f, 0.95f, 1f, 0.66f);
        [Range(0f, 8f)] public float OutlineWidth = 1.4f;
        public Color GlowColor = new Color(0.23f, 0.91f, 1f, 1f);
        [Range(0f, 4f)] public float GlowPower = 1f;
        public Color BevelLight = new Color(1f, 1f, 1f, 0.42f);
        public Color BevelDark = new Color(0.06f, 0.16f, 0.27f, 0.36f);
        public Color SheenColor = new Color(1f, 1f, 1f, 0.34f);
        [Range(0f, 1f)] public float SheenOpacity = 0.4f;
        [Range(-180f, 180f)] public float SheenAngle = -12f;
        public Color GlitchRed = new Color(1f, 0.28f, 0.55f, 0.55f);
        public Color GlitchCyan = new Color(0.18f, 0.94f, 1f, 0.65f);
        [Range(0f, 6f)] public float GlitchOffset = 2f;
        [Range(0f, 1.5f)] public float GlitchIntensity = 0.4f;
        [Range(0f, 1f)] public float ScanlineOpacity = 0.08f;
        public bool ReducedMotion = false;
    }
}
