#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Fonts/SlateFontInfo.h"
#include "AXMTextStyle.generated.h"

UCLASS(BlueprintType)
class UAXMTextStyle : public UDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Typography")
    FSlateFontInfo Font;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Typography")
    FLinearColor Color = FLinearColor::White;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Typography", meta=(ClampMin="0.8", ClampMax="2.0"))
    float LineHeight = 1.2f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Typography")
    int32 LetterSpacing = 0;
};
