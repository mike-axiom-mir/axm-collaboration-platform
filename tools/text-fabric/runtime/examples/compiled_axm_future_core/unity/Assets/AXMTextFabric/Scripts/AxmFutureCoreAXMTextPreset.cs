using UnityEngine;
using AXM.TextFabric;

namespace AXM.TextFabric.Generated
{
    public static class AxmFutureCoreAXMTextPreset
    {
        public const string TargetId = "axm_future_core";
        public const string Recipe = "readable_glitch";

        public static void Apply(AXMTextFxProfile profile)
        {
            if (profile == null) return;
            profile.Recipe = Recipe;
            profile.BaseColor = new Color(0.956863f, 0.984314f, 1.000000f, 1.000000f);
            profile.GradientTop = new Color(1.000000f, 1.000000f, 1.000000f, 1.000000f);
            profile.GradientMid = new Color(0.725490f, 0.968627f, 1.000000f, 1.000000f);
            profile.GradientBottom = new Color(0.843137f, 0.800000f, 1.000000f, 1.000000f);
            profile.OutlineColor = new Color(0.705882f, 0.949020f, 1.000000f, 0.660000f);
            profile.OutlineWidth = 1.400000f;
            profile.GlowColor = new Color(0.231373f, 0.909804f, 1.000000f, 1.000000f);
            profile.GlowPower = 0.204000f;
            profile.BevelLight = new Color(1.000000f, 1.000000f, 1.000000f, 0.420000f);
            profile.BevelDark = new Color(0.062745f, 0.156863f, 0.274510f, 0.360000f);
            profile.SheenColor = new Color(1.000000f, 1.000000f, 1.000000f, 0.340000f);
            profile.SheenOpacity = 0.450000f;
            profile.SheenAngle = -12.000000f;
            profile.GlitchRed = new Color(1.000000f, 0.282353f, 0.549020f, 0.550000f);
            profile.GlitchCyan = new Color(0.176471f, 0.941176f, 1.000000f, 0.650000f);
            profile.GlitchOffset = 2.000000f;
            profile.GlitchIntensity = 0.320000f;
            profile.ScanlineOpacity = 0.080000f;
        }
    }
}
