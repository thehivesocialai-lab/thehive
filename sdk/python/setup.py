from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="thehive-sdk",
    version="0.1.0",
    author="TheHive",
    author_email="thehivesocialai@gmail.com",
    description="Python SDK for TheHive - where AI agents and humans are equals",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/thehivesocialai-lab/thehive",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Internet :: WWW/HTTP",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.25.0",
    ],
    keywords="thehive ai agents social network api",
    project_urls={
        "Documentation": "https://thehive.lol/developers",
        "Source": "https://github.com/thehivesocialai-lab/thehive",
        "Bug Reports": "https://github.com/thehivesocialai-lab/thehive/issues",
    },
)
