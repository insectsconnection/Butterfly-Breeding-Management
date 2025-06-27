import streamlit as st
import pandas as pd
import datetime as dt
from datetime import datetime, timedelta
import time
import json
import os
from twilio_service import send_feeding_notification
from data_manager import DataManager

# Initialize session state
if 'data_manager' not in st.session_state:
    st.session_state.data_manager = DataManager()

if 'last_notification_check' not in st.session_state:
    st.session_state.last_notification_check = datetime.now()

# Page configuration
st.set_page_config(
    page_title="Larval Management System",
    page_icon="🐛",
    layout="wide"
)

st.title("🐛 Larval Management & Feeding Notification System")

# Sidebar for navigation
st.sidebar.title("Navigation")
page = st.sidebar.selectbox("Select Page", ["Dashboard", "Add New Batch", "Settings", "Feeding Log"])

# Auto-check for notifications every minute
current_time = datetime.now()
if (current_time - st.session_state.last_notification_check).seconds >= 60:
    st.session_state.data_manager.check_and_send_notifications()
    st.session_state.last_notification_check = current_time

if page == "Dashboard":
    st.header("📊 Dashboard")
    
    # Get active batches
    active_batches = st.session_state.data_manager.get_active_batches()
    
    if active_batches.empty:
        st.info("No active larval batches. Add a new batch to get started!")
    else:
        st.subheader("Active Larval Batches")
        
        # Display batches in cards
        for idx, batch in active_batches.iterrows():
            with st.container():
                col1, col2, col3, col4 = st.columns([2, 2, 2, 1])
                
                with col1:
                    st.write(f"**Batch ID:** {batch['batch_id']}")
                    st.write(f"**Species:** {batch['species']}")
                    st.write(f"**Count:** {batch['larval_count']}")
                
                with col2:
                    st.write(f"**Start Date:** {batch['start_date'].strftime('%Y-%m-%d')}")
                    st.write(f"**Feeding Interval:** Every {batch['feeding_interval']} days")
                    st.write(f"**Phone:** {batch['phone_number']}")
                
                with col3:
                    next_feeding = batch['next_feeding']
                    time_until_feeding = next_feeding - datetime.now()
                    
                    if time_until_feeding.total_seconds() <= 0:
                        st.error("⚠️ FEEDING OVERDUE!")
                        st.write("**Next Feeding:** OVERDUE")
                    elif time_until_feeding.total_seconds() <= 3600:  # 1 hour
                        st.warning("🔔 FEEDING SOON!")
                        st.write(f"**Next Feeding:** {next_feeding.strftime('%Y-%m-%d %H:%M')}")
                    else:
                        st.success("✅ On Schedule")
                        st.write(f"**Next Feeding:** {next_feeding.strftime('%Y-%m-%d %H:%M')}")
                    
                    # Countdown timer
                    if time_until_feeding.total_seconds() > 0:
                        hours, remainder = divmod(int(time_until_feeding.total_seconds()), 3600)
                        minutes, seconds = divmod(remainder, 60)
                        st.write(f"**Time Remaining:** {hours}h {minutes}m {seconds}s")
                    else:
                        overdue_time = abs(time_until_feeding.total_seconds())
                        hours, remainder = divmod(int(overdue_time), 3600)
                        minutes, seconds = divmod(remainder, 60)
                        st.write(f"**Overdue by:** {hours}h {minutes}m {seconds}s")
                
                with col4:
                    if st.button(f"📱 Send SMS", key=f"sms_{batch['batch_id']}"):
                        message = f"🐛 Larval Feeding Reminder: Batch {batch['batch_id']} ({batch['species']}) needs feeding now! Count: {batch['larval_count']}"
                        success = send_feeding_notification(batch['phone_number'], message)
                        if success:
                            st.success("SMS sent!")
                            st.session_state.data_manager.log_feeding_activity(batch['batch_id'], "Manual SMS sent")
                        else:
                            st.error("Failed to send SMS")
                    
                    if st.button(f"🍃 Fed", key=f"fed_{batch['batch_id']}"):
                        st.session_state.data_manager.mark_as_fed(batch['batch_id'])
                        st.success("Batch marked as fed!")
                        st.rerun()
                
                st.divider()

elif page == "Add New Batch":
    st.header("➕ Add New Larval Batch")
    
    with st.form("add_batch_form"):
        col1, col2 = st.columns(2)
        
        with col1:
            batch_id = st.text_input("Batch ID*", help="Unique identifier for this batch")
            species = st.text_input("Species*", help="e.g., Monarch Butterfly, Cabbage White")
            larval_count = st.number_input("Number of Larvae*", min_value=1, value=10)
            phone_number = st.text_input("Phone Number*", help="Format: +1234567890")
        
        with col2:
            start_date = st.date_input("Start Date*", value=datetime.now().date())
            feeding_time = st.time_input("Feeding Time*", value=datetime.now().time())
            feeding_interval = st.selectbox("Feeding Interval*", [1, 2, 3, 4, 5, 6, 7], 
                                          format_func=lambda x: f"Every {x} day{'s' if x > 1 else ''}")
            notes = st.text_area("Notes", help="Optional notes about this batch")
        
        submitted = st.form_submit_button("Add Batch")
        
        if submitted:
            if not all([batch_id, species, larval_count, phone_number]):
                st.error("Please fill in all required fields marked with *")
            elif not phone_number.startswith('+'):
                st.error("Phone number must start with + and include country code")
            else:
                # Combine date and time for next feeding
                start_datetime = datetime.combine(start_date, feeding_time)
                next_feeding = start_datetime + timedelta(days=feeding_interval)
                
                success = st.session_state.data_manager.add_batch(
                    batch_id, species, larval_count, phone_number,
                    start_datetime, feeding_interval, notes, next_feeding
                )
                
                if success:
                    st.success(f"Batch {batch_id} added successfully!")
                    st.session_state.data_manager.log_feeding_activity(batch_id, "Batch created")
                else:
                    st.error("Failed to add batch. Batch ID might already exist.")

elif page == "Settings":
    st.header("⚙️ Settings")
    
    st.subheader("Twilio Configuration")
    
    # Display current Twilio settings (masked for security)
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "Not configured")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "Not configured")
    phone_number = os.getenv("TWILIO_PHONE_NUMBER", "Not configured")
    
    st.write("**Account SID:**", "***" + account_sid[-4:] if len(account_sid) > 4 else "Not configured")
    st.write("**Auth Token:**", "***" + auth_token[-4:] if len(auth_token) > 4 else "Not configured")
    st.write("**Phone Number:**", phone_number)
    
    if account_sid == "Not configured" or auth_token == "Not configured" or phone_number == "Not configured":
        st.warning("⚠️ Twilio is not properly configured. SMS notifications will not work.")
        st.info("""
        To configure Twilio, set these environment variables:
        - TWILIO_ACCOUNT_SID
        - TWILIO_AUTH_TOKEN  
        - TWILIO_PHONE_NUMBER
        """)
    else:
        st.success("✅ Twilio is configured and ready!")
    
    st.subheader("Test SMS")
    test_phone = st.text_input("Test Phone Number", placeholder="+1234567890")
    test_message = st.text_area("Test Message", value="This is a test message from the Larval Management System!")
    
    if st.button("Send Test SMS"):
        if test_phone and test_message:
            success = send_feeding_notification(test_phone, test_message)
            if success:
                st.success("Test SMS sent successfully!")
            else:
                st.error("Failed to send test SMS. Check your Twilio configuration.")
        else:
            st.error("Please enter both phone number and message.")
    
    st.subheader("Batch Management")
    if st.button("Clear All Completed Batches"):
        cleared_count = st.session_state.data_manager.clear_completed_batches()
        st.success(f"Cleared {cleared_count} completed batches.")
    
    if st.button("Export Data"):
        csv_data = st.session_state.data_manager.export_to_csv()
        st.download_button(
            label="Download CSV",
            data=csv_data,
            file_name=f"larval_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )

elif page == "Feeding Log":
    st.header("📋 Feeding Activity Log")
    
    log_data = st.session_state.data_manager.get_feeding_log()
    
    if log_data.empty:
        st.info("No feeding activities recorded yet.")
    else:
        st.dataframe(
            log_data,
            use_container_width=True,
            column_config={
                "timestamp": st.column_config.DatetimeColumn(
                    "Timestamp",
                    format="DD/MM/YY HH:mm"
                ),
                "batch_id": "Batch ID",
                "activity": "Activity"
            }
        )
        
        # Summary statistics
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Activities", len(log_data))
        with col2:
            feeding_activities = log_data[log_data['activity'].str.contains('fed|Fed', case=False)]
            st.metric("Feeding Events", len(feeding_activities))
        with col3:
            sms_activities = log_data[log_data['activity'].str.contains('SMS', case=False)]
            st.metric("SMS Sent", len(sms_activities))

# Auto-refresh for countdown timers
if page == "Dashboard" and not st.session_state.data_manager.get_active_batches().empty:
    time.sleep(1)
    st.rerun()
