// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IL2ToL2CrossDomainMessenger} from "optimism/packages/contracts-bedrock/interfaces/L2/IL2ToL2CrossDomainMessenger.sol"; 
import {Predeploys} from "optimism/packages/contracts-bedrock/src/libraries/Predeploys.sol";

error CallerNotL2ToL2CrossDomainMessenger();
error InvalidCrossDomainSender();

contract SuperchainFactory {
    IL2ToL2CrossDomainMessenger internal _messenger =
        IL2ToL2CrossDomainMessenger(Predeploys.L2_TO_L2_CROSS_DOMAIN_MESSENGER);

    modifier onlyCrossDomainCallback() {
        if (msg.sender != address(_messenger))
            revert CallerNotL2ToL2CrossDomainMessenger();
        if (_messenger.crossDomainMessageSender() != address(this))
            revert InvalidCrossDomainSender();
        _;
    }

    event ContractDeployed(
        address indexed contractAddress,
        uint256 indexed chainId
    );
    event CrossChainMessageSent(
        uint256 indexed chainId,
        address indexed targetFactory
    );

    /**
     * @dev Deploys a contract with constructor arguments on multiple chains.
     * @param chainIds Array of chain IDs on which to deploy the contract.
     * @param bytecode The creation bytecode of the contract to deploy.
     * @param constructorArgs The ABI-encoded constructor arguments.
     * @param salt A unique salt for deterministic deployment (CREATE2).
     */
    function deployEverywhere(
        uint256[] calldata chainIds,
        bytes memory bytecode,
        bytes memory constructorArgs,
        bytes32 salt
    ) external returns(address){
        // Combine bytecode with constructor arguments
        bytes memory deployBytecode = bytes.concat(bytecode, constructorArgs);
        
        address deployedAddr = _deploy(deployBytecode, salt);
        emit ContractDeployed(deployedAddr, block.chainid);

        // Send cross-chain messages to each target chain
        for (uint i = 0; i < chainIds.length; i++) {
            if(block.chainid == chainIds[i]) continue;
            bytes memory message = abi.encodeCall(
                this.deploy, 
                (deployBytecode, salt)
            );
            _messenger.sendMessage(
                chainIds[i],
                address(this),
                message
            );
            emit CrossChainMessageSent(chainIds[i], address(this));
        }
        return deployedAddr;
    }

    /**
     * @dev Deploys a contract when triggered by a cross-chain message.
     * @param bytecode The creation bytecode + constructor args of the contract.
     * @param salt A unique salt for deterministic deployment (CREATE2).
     */
    function deploy(
        bytes memory bytecode,
        bytes32 salt
    ) external onlyCrossDomainCallback {
        _deploy(bytecode, salt);
    }

    /**
     * @dev Internal helper function to deploy a contract using CREATE2.
     * @param bytecode The complete bytecode including constructor arguments.
     * @param salt A unique salt for deterministic deployment.
     * @return The address of the deployed contract.
     */
    function _deploy(
        bytes memory bytecode,
        bytes32 salt
    ) internal returns (address) {
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        return addr;
    }

    /**
     * @dev Helper function to compute the address where a contract will be deployed.
     * @param bytecode The complete bytecode including constructor arguments.
     * @param salt The salt for CREATE2.
     * @return The computed address.
     */
    function computeAddress(
        bytes memory bytecode,
        bytes32 salt
    ) public view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }
}