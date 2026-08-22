using TMPro;
using UnityEngine;

namespace AXM.TextFabric
{
    [DisallowMultipleComponent]
    public sealed class AXMTextStyleApplier : MonoBehaviour
    {
        [SerializeField] private TMP_Text target;
        [SerializeField] private float fontSize = 30f;
        [SerializeField] private FontWeight fontWeight = FontWeight.SemiBold;
        [SerializeField] private float characterSpacing = 0f;
        [SerializeField] private bool enableWrapping = true;
        [SerializeField] private TextOverflowModes overflow = TextOverflowModes.Overflow;

        private void Reset() => target = GetComponent<TMP_Text>();

        private void Awake()
        {
            if (target == null)
            {
                Debug.LogError("AXMTextStyleApplier requires a TMP_Text target.", this);
                enabled = false;
                return;
            }
            Apply();
        }

        [ContextMenu("Apply AXM Text Style")]
        public void Apply()
        {
            target.fontSize = Mathf.Max(1f, fontSize);
            target.fontWeight = fontWeight;
            target.characterSpacing = characterSpacing;
            target.enableWordWrapping = enableWrapping;
            target.overflowMode = overflow;
        }
    }
}
