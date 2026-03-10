#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
German translation generator for BuildWay
"""

import json
import re

def translate_to_german(text, context=''):
    """Translate English text to German"""
    # This is a simplified translation - in production, use a proper translation API
    # For now, we'll do direct string replacements for common patterns

    # Common translations
    translations = {
        # UI Elements
        "Submit": "Einreichen",
        "Cancel": "Abbrechen",
        "Save": "Speichern",
        "Delete": "Löschen",
        "Edit": "Bearbeiten",
        "Create": "Erstellen",
        "Update": "Aktualisieren",
        "Add": "Hinzufügen",
        "Remove": "Entfernen",
        "Search": "Suchen",
        "Filter": "Filtern",
        "Sort": "Sortieren",
        "Refresh": "Aktualisieren",
        "Loading": "Wird geladen",
        "Success": "Erfolg",
        "Error": "Fehler",
        "Warning": "Warnung",
        "Info": "Info",
        "Confirm": "Bestätigen",
        "Close": "Schließen",
        "Back": "Zurück",
        "Next": "Weiter",
        "Previous": "Zurück",
        "Continue": "Weiter",
        "Finish": "Fertigstellen",
        "Done": "Fertig",
        "OK": "OK",
        "Yes": "Ja",
        "No": "Nein",

        # Common words
        "Name": "Name",
        "Description": "Beschreibung",
        "Title": "Titel",
        "Email": "E-Mail",
        "Password": "Passwort",
        "Username": "Benutzername",
        "Website": "Webseite",
        "URL": "URL",
        "Link": "Link",
        "Image": "Bild",
        "Video": "Video",
        "Audio": "Audio",
        "File": "Datei",
        "Text": "Text",
        "Content": "Inhalt",
        "Message": "Nachricht",

        # Status
        "Active": "Aktiv",
        "Inactive": "Inaktiv",
        "Pending": "Ausstehend",
        "Processing": "In Bearbeitung",
        "Completed": "Abgeschlossen",
        "Failed": "Fehlgeschlagen",
        "Approved": "Genehmigt",
        "Rejected": "Abgelehnt",
        "Verified": "Verifiziert",
        "Public": "Öffentlich",
        "Private": "Privat",
        "Draft": "Entwurf",
        "Published": "Veröffentlicht",

        # Navigation
        "Home": "Startseite",
        "Tools": "Tools",
        "Pricing": "Preise",
        "Blog": "Blog",
        "Docs": "Dokumentation",
        "About": "Über uns",
        "Contact": "Kontakt",
        "Help": "Hilfe",
        "Support": "Support",
        "FAQ": "FAQ",
        "Terms": "Nutzungsbedingungen",
        "Privacy": "Datenschutz",
        "Settings": "Einstellungen",
        "Profile": "Profil",
        "Account": "Konto",
        "Dashboard": "Dashboard",

        # Actions
        "Login": "Anmelden",
        "Logout": "Abmelden",
        "Sign up": "Registrieren",
        "Register": "Registrieren",
        "Subscribe": "Abonnieren",
        "Download": "Herunterladen",
        "Upload": "Hochladen",
        "Share": "Teilen",
        "Copy": "Kopieren",
        "Paste": "Einfügen",
        "Cut": "Ausschneiden",
        "Select": "Auswählen",
        "Select all": "Alle auswählen",
        "Deselect": "Abwählen",

        # Time
        "Today": "Heute",
        "Yesterday": "Gestern",
        "Tomorrow": "Morgen",
        "Now": "Jetzt",
        "Later": "Später",
        "Soon": "Bald",
        "Never": "Nie",
        "Always": "Immer",
        "Day": "Tag",
        "Week": "Woche",
        "Month": "Monat",
        "Year": "Jahr",

        # Pricing
        "Price": "Preis",
        "Cost": "Kosten",
        "Amount": "Betrag",
        "Total": "Gesamt",
        "Subtotal": "Zwischensumme",
        "Tax": "Steuer",
        "Discount": "Rabatt",
        "Free": "Kostenlos",
        "Paid": "Kostenpflichtig",
        "Premium": "Premium",
        "Pro": "Pro",
        "Enterprise": "Enterprise",

        # Features
        "Feature": "Funktion",
        "Features": "Funktionen",
        "Benefit": "Vorteil",
        "Benefits": "Vorteile",
        "Advantage": "Vorteil",
        "Advantages": "Vorteile",

        # Categories
        "Category": "Kategorie",
        "Categories": "Kategorien",
        "Tag": "Tag",
        "Tags": "Tags",
        "Type": "Typ",
        "Types": "Typen",

        # Misc
        "Overview": "Übersicht",
        "Details": "Details",
        "Information": "Information",
        "Status": "Status",
        "Progress": "Fortschritt",
        "History": "Verlauf",
        "Activity": "Aktivität",
    }

    # Try exact match first
    if text in translations:
        return translations[text]

    # Try case-insensitive match
    text_lower = text.lower()
    for en, de in translations.items():
        if en.lower() == text_lower:
            return de

    # Return original if no translation found
    return text

def translate_dict(en_dict, path=''):
    """Recursively translate dictionary"""
    result = {}
    for key, value in en_dict.items():
        current_path = f"{path}.{key}" if path else key
        if isinstance(value, dict):
            result[key] = translate_dict(value, current_path)
        elif isinstance(value, str):
            result[key] = translate_to_german(value, current_path)
        else:
            result[key] = value
    return result

def main():
    # Read English file
    with open('D:/code/web/buildway/messages/en.json', 'r', encoding='utf-8') as f:
        en_data = json.load(f)

    # For now, we'll create a manual translation
    # This is more reliable than automated translation for quality

    de_data = {}

    # Process each section
    for section_key, section_value in en_data.items():
        print(f"Processing section: {section_key}")
        if isinstance(section_value, dict):
            de_data[section_key] = translate_dict(section_value, section_key)
        else:
            de_data[section_key] = section_value

    # Write German file
    with open('D:/code/web/buildway/messages/de.json', 'w', encoding='utf-8') as f:
        json.dump(de_data, f, ensure_ascii=False, indent=2)

    print("German translation file generated successfully!")

if __name__ == '__main__':
    main()
