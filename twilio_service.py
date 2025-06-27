import os
from twilio.rest import Client
import streamlit as st

def send_feeding_notification(to_phone_number: str, message: str) -> bool:
    """
    Send SMS notification using Twilio
    
    Args:
        to_phone_number: Phone number to send SMS to (format: +1234567890)
        message: Message content to send
    
    Returns:
        bool: True if message sent successfully, False otherwise
    """
    try:
        # Get Twilio credentials from environment variables
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        from_phone_number = os.getenv("TWILIO_PHONE_NUMBER")
        
        # Check if all required credentials are available
        if not all([account_sid, auth_token, from_phone_number]):
            st.error("Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.")
            return False
        
        # Initialize Twilio client
        client = Client(account_sid, auth_token)
        
        # Send the SMS message
        message_instance = client.messages.create(
            body=message,
            from_=from_phone_number,
            to=to_phone_number
        )
        
        print(f"Message sent successfully with SID: {message_instance.sid}")
        return True
        
    except Exception as e:
        print(f"Error sending SMS: {str(e)}")
        st.error(f"Failed to send SMS: {str(e)}")
        return False

def format_feeding_reminder_message(batch_id: str, species: str, larval_count: int, overdue_hours: int = 0) -> str:
    """
    Format a standardized feeding reminder message
    
    Args:
        batch_id: Unique identifier for the larval batch
        species: Species name
        larval_count: Number of larvae in the batch
        overdue_hours: Hours overdue (0 if on time)
    
    Returns:
        str: Formatted message string
    """
    base_message = f"🐛 Larval Feeding Reminder\n\nBatch: {batch_id}\nSpecies: {species}\nCount: {larval_count} larvae"
    
    if overdue_hours > 0:
        base_message += f"\n\n⚠️ OVERDUE by {overdue_hours} hours! Please feed immediately."
    else:
        base_message += f"\n\n🍃 Time to add fresh leaves for feeding."
    
    base_message += "\n\nLarval Management System"
    
    return base_message

def send_batch_notification(batch_data: dict, overdue_hours: int = 0) -> bool:
    """
    Send notification for a specific batch
    
    Args:
        batch_data: Dictionary containing batch information
        overdue_hours: Hours overdue (0 if on time)
    
    Returns:
        bool: True if notification sent successfully
    """
    message = format_feeding_reminder_message(
        batch_data['batch_id'],
        batch_data['species'],
        batch_data['larval_count'],
        overdue_hours
    )
    
    return send_feeding_notification(batch_data['phone_number'], message)
