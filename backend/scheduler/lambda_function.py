"""
Lambda function to trigger App Runner research endpoint.
Called by EventBridge on a schedule.
"""
import os
import urllib.request
import json

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest


def handler(event, context):
    """Trigger the research endpoint on App Runner."""
    
    app_runner_url = os.environ.get('APP_RUNNER_URL')
    if not app_runner_url:
        raise ValueError("APP_RUNNER_URL environment variable not set")
    
    # Remove any protocol if included
    if app_runner_url.startswith('https://'):
        app_runner_url = app_runner_url.replace('https://', '')
    elif app_runner_url.startswith('http://'):
        app_runner_url = app_runner_url.replace('http://', '')
    
    url = f"https://{app_runner_url}/research"
    
    try:
        # Create POST request with empty JSON body (agent will pick topic)
        data = json.dumps({}).encode('utf-8')
        # The researcher URL uses AWS_IAM auth, so sign the request with this Lambda's role
        signed = AWSRequest(method='POST', url=url, data=data, headers={'Content-Type': 'application/json'})
        session = boto3.Session()
        SigV4Auth(session.get_credentials(), 'lambda', session.region_name).add_auth(signed)
        req = urllib.request.Request(url, data=data, method='POST', headers=dict(signed.headers))
        
        with urllib.request.urlopen(req, timeout=180) as response:
            result = response.read().decode('utf-8')
            print(f"Research triggered successfully: {result}")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Research triggered successfully',
                    'result': result
                })
            }
    except Exception as e:
        print(f"Error triggering research: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }