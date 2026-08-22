using UnityEngine;
using UnityEngine.UIElements;

/// <summary>
/// Applies an AXM-exported UI Toolkit StyleSheet to a UIDocument.
/// Dynamic AetherFX effects still need native Unity implementations.
/// </summary>
[RequireComponent(typeof(UIDocument))]
public sealed class AXMAetherThemeLoader : MonoBehaviour
{
    [SerializeField] private StyleSheet axmStyleSheet;
    private UIDocument document;

    private void OnEnable()
    {
        document = GetComponent<UIDocument>();
        Apply();
    }

    public void Apply()
    {
        if (document == null || document.rootVisualElement == null || axmStyleSheet == null)
        {
            Debug.LogWarning("AXMAetherThemeLoader: assign a UIDocument and exported AXM USS stylesheet.", this);
            return;
        }
        if (!document.rootVisualElement.styleSheets.Contains(axmStyleSheet))
            document.rootVisualElement.styleSheets.Add(axmStyleSheet);
    }

    public void Remove()
    {
        if (document?.rootVisualElement != null && axmStyleSheet != null)
            document.rootVisualElement.styleSheets.Remove(axmStyleSheet);
    }
}
