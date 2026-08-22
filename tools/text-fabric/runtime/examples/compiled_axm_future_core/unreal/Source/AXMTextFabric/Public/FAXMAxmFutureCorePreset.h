#pragma once

#include "CoreMinimal.h"
#include "Materials/MaterialInstanceDynamic.h"

struct FAXMAxmFutureCorePreset
{
    static constexpr const TCHAR* TargetId = TEXT("axm_future_core");
    static constexpr const TCHAR* Recipe = TEXT("readable_glitch");

    static void Apply(UMaterialInstanceDynamic* Material)
    {
        if (!Material) return;
        Material->SetVectorParameterValue(TEXT("BaseColor"), FLinearColor(0.956863f, 0.984314f, 1.000000f, 1.000000f));
        Material->SetVectorParameterValue(TEXT("GradientTop"), FLinearColor(1.000000f, 1.000000f, 1.000000f, 1.000000f));
        Material->SetVectorParameterValue(TEXT("GradientMid"), FLinearColor(0.725490f, 0.968627f, 1.000000f, 1.000000f));
        Material->SetVectorParameterValue(TEXT("GradientBottom"), FLinearColor(0.843137f, 0.800000f, 1.000000f, 1.000000f));
        Material->SetVectorParameterValue(TEXT("OutlineColor"), FLinearColor(0.705882f, 0.949020f, 1.000000f, 0.660000f));
        Material->SetScalarParameterValue(TEXT("OutlineWidth"), 1.400000f);
        Material->SetVectorParameterValue(TEXT("GlowColor"), FLinearColor(0.231373f, 0.909804f, 1.000000f, 1.000000f));
        Material->SetScalarParameterValue(TEXT("GlowPower"), 0.204000f);
        Material->SetScalarParameterValue(TEXT("SheenOpacity"), 0.450000f);
        Material->SetScalarParameterValue(TEXT("SheenAngle"), -12.000000f);
        Material->SetVectorParameterValue(TEXT("GlitchRed"), FLinearColor(1.000000f, 0.282353f, 0.549020f, 0.550000f));
        Material->SetVectorParameterValue(TEXT("GlitchCyan"), FLinearColor(0.176471f, 0.941176f, 1.000000f, 0.650000f));
        Material->SetScalarParameterValue(TEXT("GlitchOffset"), 2.000000f);
        Material->SetScalarParameterValue(TEXT("GlitchIntensity"), 0.320000f);
        Material->SetScalarParameterValue(TEXT("ScanlineOpacity"), 0.080000f);
    }
};
