#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Fonts/SlateFontInfo.h"
#include "Materials/MaterialInterface.h"
#include "AXMTextMaterialStyle.generated.h"

UCLASS(BlueprintType)
class UAXMTextMaterialStyle : public UDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Typography")
    FSlateFontInfo Font;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Typography")
    FLinearColor BaseColor = FLinearColor::White;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Typography")
    FLinearColor OutlineColor = FLinearColor(0.7f, 0.95f, 1.0f, 0.66f);

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Effects")
    float OutlineWidth = 1.4f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Effects")
    FLinearColor GlowColor = FLinearColor(0.23f, 0.91f, 1.0f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Effects")
    float GlowPower = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Effects")
    float GlitchOffset = 2.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Effects")
    float GlitchIntensity = 0.4f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Effects")
    float SheenOpacity = 0.4f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Effects")
    TObjectPtr<UMaterialInterface> TextMaterial = nullptr;
};
