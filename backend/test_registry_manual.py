from app.providers.registry import (
    initialize_providers,
    get_provider,
    get_all_providers
)


initialize_providers()

gemini = get_provider("gemini")

print("Provider:", gemini.provider_name)
print("Display name:", gemini.display_name)
print("Configured:", gemini.is_configured())
print("Supported models:", gemini.supported_models)

print("\nAll registered providers:")

for name in get_all_providers():
    print(name)